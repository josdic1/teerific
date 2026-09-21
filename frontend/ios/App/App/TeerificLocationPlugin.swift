import Foundation
import CoreLocation
import Capacitor

@objc(TeerificLocationPlugin)
public class TeerificLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "TeerificLocationPlugin"
    public let jsName = "TeerificLocation"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let locationManager = CLLocationManager()
    private var roundId: String?
    private var apiBase: String?
    private var lastAttemptedFixTimestamp: Date?

    private let maximumFixAge: TimeInterval = 5 * 60
    private let maximumFutureClockSkew: TimeInterval = 60

    private lazy var uploadSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = HTTPCookieStorage.shared
        configuration.waitsForConnectivity = true
        return URLSession(configuration: configuration)
    }()

    public override func load() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 10
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.allowsBackgroundLocationUpdates = true
    }

    @objc func start(_ call: CAPPluginCall) {
        guard
            let roundId = call.getString("roundId"),
            let apiBase = call.getString("apiBase")
        else {
            call.reject("ROUND_ID_AND_API_BASE_REQUIRED")
            return
        }

        if self.roundId != roundId {
            lastAttemptedFixTimestamp = nil
        }

        self.roundId = roundId
        self.apiBase = apiBase

        locationManager.requestAlwaysAuthorization()
        locationManager.startUpdatingLocation()

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.locationManager.requestLocation()
        }

        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        locationManager.stopUpdatingLocation()
        roundId = nil
        apiBase = nil
        lastAttemptedFixTimestamp = nil
        call.resolve()
    }

    public func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let location = locations.last else { return }

        let age = Date().timeIntervalSince(location.timestamp)

        guard age <= maximumFixAge else {
            debugLog(
                "rejected=too_old fixAt=\(location.timestamp.ISO8601Format()) ageSeconds=\(age)"
            )
            return
        }

        guard age >= -maximumFutureClockSkew else {
            debugLog(
                "rejected=future_dated fixAt=\(location.timestamp.ISO8601Format()) ageSeconds=\(age)"
            )
            return
        }

        if let lastAttemptedFixTimestamp,
           location.timestamp <= lastAttemptedFixTimestamp {
            debugLog(
                "rejected=duplicate_or_out_of_order fixAt=\(location.timestamp.ISO8601Format()) lastFixAt=\(lastAttemptedFixTimestamp.ISO8601Format())"
            )
            return
        }

        let sampleId = UUID().uuidString.lowercased()
        lastAttemptedFixTimestamp = location.timestamp

        debugLog(
            "accepted sampleId=\(sampleId) fixAt=\(location.timestamp.ISO8601Format()) latitude=\(location.coordinate.latitude) longitude=\(location.coordinate.longitude) accuracy=\(location.horizontalAccuracy)"
        )

        upload(
            location,
            sampleId: sampleId
        )
    }


    public func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        print("TEERIFIC GPS LOCATION ERROR:", error.localizedDescription)
    }

    private func upload(
        _ location: CLLocation,
        sampleId: String
    ) {
        guard
            let roundId,
            let apiBase,
            let url = URL(
                string: "\(apiBase)/api/rounds/\(roundId)/location-samples"
            )
        else {
            return
        }

        let body: [String: Any?] = [
            "sampleId": sampleId,
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "accuracyMeters": location.horizontalAccuracy >= 0
                ? location.horizontalAccuracy
                : nil,
            "altitudeMeters": location.verticalAccuracy >= 0
                ? location.altitude
                : nil,
            "speedMetersPerSecond": location.speed >= 0
                ? location.speed
                : nil,
            "headingDegrees": location.course >= 0
                ? location.course
                : nil,
            "recordedAt": ISO8601DateFormatter()
                .string(from: location.timestamp)
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(
            "application/json",
            forHTTPHeaderField: "Content-Type"
        )
        request.setValue(
            sampleId,
            forHTTPHeaderField: "X-Teerific-Sample-Id"
        )
        let jsonBody: [String: Any] = body.mapValues {
            $0 ?? NSNull()
        }

        request.httpBody = try? JSONSerialization.data(
            withJSONObject: jsonBody
        )

        send(
            request,
            sampleId: sampleId,
            attempt: 1
        )
    }

    private func send(
        _ request: URLRequest,
        sampleId: String,
        attempt: Int
    ) {
        uploadSession
            .dataTask(with: request) { data, response, error in
                if let error {
                    if attempt < 3 {
                        self.retry(
                            request,
                            sampleId: sampleId,
                            attempt: attempt + 1,
                            reason: error.localizedDescription
                        )
                        return
                    }

                    print(
                        "TEERIFIC GPS UPLOAD ERROR:",
                        "sampleId=\(sampleId)",
                        error
                    )
                    return
                }

                let status =
                    (response as? HTTPURLResponse)?.statusCode ?? -1

                let responseBody = data.flatMap {
                    String(data: $0, encoding: .utf8)
                }

                if (500...599).contains(status),
                   attempt < 3 {
                    self.retry(
                        request,
                        sampleId: sampleId,
                        attempt: attempt + 1,
                        reason: "HTTP \(status)"
                    )
                    return
                }

                if !(200...299).contains(status) {
                    print(
                        "TEERIFIC GPS UPLOAD ERROR:",
                        "sampleId=\(sampleId)",
                        "status=\(status)",
                        responseBody ?? "<empty>"
                    )
                    return
                }

                self.debugLog(
                    "uploaded sampleId=\(sampleId) attempt=\(attempt) status=\(status) response=\(responseBody ?? "<empty>")"
                )
            }
            .resume()
    }

    private func retry(
        _ request: URLRequest,
        sampleId: String,
        attempt: Int,
        reason: String
    ) {
        let delay =
            pow(
                2.0,
                Double(attempt - 2)
            )

        debugLog(
            "retrying sampleId=\(sampleId) attempt=\(attempt) delaySeconds=\(delay) reason=\(reason)"
        )

        DispatchQueue.global().asyncAfter(
            deadline: .now() + delay
        ) {
            self.send(
                request,
                sampleId: sampleId,
                attempt: attempt
            )
        }
    }

    private func debugLog(_ message: String) {
        #if DEBUG
        print("TEERIFIC GPS TRACE:", message)
        #endif
    }
}
