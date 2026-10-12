import WidgetKit
import SwiftUI

@main
struct NewKetWidgetBundle: WidgetBundle {
    var body: some Widget {
        NewKetQuickActionsWidget()
        if #available(iOS 16.1, *) {
            NewKetOrderLiveActivity()
        }
    }
}
