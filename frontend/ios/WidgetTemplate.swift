import ActivityKit
import WidgetKit
import SwiftUI

@available(iOS 16.1, *)
struct NewKetWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TrackingAttributes.self) { context in
            // Vue de l'écran verrouillé et bannières
            VStack {
                HStack {
                    Text("\(context.attributes.title) \(context.attributes.icon)")
                        .font(.headline)
                    Spacer()
                    Text(context.state.statusTitle)
                        .font(.subheadline)
                        .bold()
                        .foregroundColor(.blue)
                }
                
                ProgressView(value: context.state.progress, total: 1.0)
                    .tint(.blue)
                    .padding(.vertical, 4)
                
                HStack {
                    Text(context.attributes.entityId)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(context.state.statusDescription)
                        .font(.caption)
                }
            }
            .padding()
            
        } dynamicIsland: { context in
            DynamicIsland {
                // Vue Étendue
                DynamicIslandExpandedRegion(.leading) {
                    Text("\(context.attributes.title)")
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.statusTitle)
                        .font(.caption)
                        .bold()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading) {
                        ProgressView(value: context.state.progress, total: 1.0)
                            .tint(.blue)
                        HStack {
                            Text(context.attributes.entityId)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            Spacer()
                            Text(context.state.statusDescription)
                                .font(.caption2)
                        }
                    }
                }
            } compactLeading: {
                Text(context.attributes.icon)
            } compactTrailing: {
                Text(context.state.statusTitle)
                    .font(.caption2)
            } minimal: {
                Text(context.attributes.icon)
            }
        }
    }
}
