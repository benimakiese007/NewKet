#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeTabBarPlugin, "NativeTabBarPlugin",
    CAP_PLUGIN_METHOD(isNativeAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(show, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(hide, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setActiveTab, CAPPluginReturnPromise);
)
