import Capacitor

class TeerificBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TeerificLocationPlugin())
    }
}
