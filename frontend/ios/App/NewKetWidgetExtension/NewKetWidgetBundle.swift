import WidgetKit
import SwiftUI

@main
struct NewKetWidgetBundle: WidgetBundle {
    var body: some Widget {
        NewKetQuickActionsWidget()
        NewKetOrderLiveActivity()
    }
}
