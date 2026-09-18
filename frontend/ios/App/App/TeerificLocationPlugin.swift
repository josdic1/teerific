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
        call.resolve()
    }

    public func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let location = locations.last else { return }
        upload(location)
    }


    public func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        print("TEERIFIC GPS LOCATION ERROR:", error.localizedDescription)
    }

    private func upload(_ location: CLLocation) {
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
        let jsonBody: [String: Any] = body.mapValues {
            $0 ?? NSNull()
        }

        request.httpBody = try? JSONSerialization.data(
            withJSONObject: jsonBody
        )

        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = HTTPCookieStorage.shared

        URLSession(configuration: configuration)
            .dataTask(with: request) { data, response, error in
                if let error {
                    print("TEERIFIC GPS UPLOAD ERROR:", error)
                    return
                }

                let status =
                    (response as? HTTPURLResponse)?.statusCode ?? -1

                if !(200...299).contains(status),
                   let data,
                   let body = String(data: data, encoding: .utf8) {
                    print("TEERIFIC GPS UPLOAD BODY:", body)
                }
            }
            .resume()
    }
}
