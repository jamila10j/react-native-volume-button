#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(VolumeButton, RCTEventEmitter)

RCT_EXTERN_METHOD(start)
RCT_EXTERN_METHOD(stop)
RCT_EXTERN_METHOD(setSwallowVolumeChanges:(nonnull NSNumber *)enable)
RCT_EXTERN_METHOD(setVolume:(nonnull NSNumber *)level)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end