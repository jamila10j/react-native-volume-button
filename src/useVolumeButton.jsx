import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AppState, NativeEventEmitter, NativeModules } from 'react-native';

const VolumeButtonNative = NativeModules.VolumeButton;

// Debug logging for native module
if (__DEV__) {
    console.log('[useHardwareVolumeButtons] VolumeButtonNative available:', !!VolumeButtonNative);
    if (VolumeButtonNative) {
        console.log('[useHardwareVolumeButtons] Available methods:', Object.keys(VolumeButtonNative));
    }
}

/**
 * Custom hook for listening to hardware volume button presses on iOS and Android
 * @param {Object} options - Configuration options
 * @param {boolean} options.swallowChanges - Snap system volume back after a press (default: false)
 * @param {boolean} options.autoStart - Automatically start listening on mount (default: true)
 * @param {boolean} options.autoPauseInBackground - Stop listening when app backgrounded (default: true)
 * @param {Function} options.onPress - Callback function called on each volume button press
 * @returns {Object} Hook state and control functions
 */
export function useHardwareVolumeButtons(options = {}) {
    const {
        swallowChanges = false,
        autoStart = true,
        autoPauseInBackground = true,
        onPress,
    } = options;

    const isSupported = !!VolumeButtonNative;
    const [isActive, setIsActive] = useState(false);
    const [lastVolumeEvent, setLastVolumeEvent] = useState(undefined);
    const currentAppState = useRef(AppState.currentState);
    const volumeEventEmitter = useMemo(
        () => (isSupported ? new NativeEventEmitter(VolumeButtonNative) : null),
        [isSupported]
    );
    const eventSubscription = useRef(null);

    // Manual control functions for external use
    const startVolumeButtonListener = useCallback(() => {
        // This will be handled by the useEffect, but we can trigger a re-render
        // by updating a dependency if needed in the future
    }, []);

    const stopVolumeButtonListener = useCallback(() => {
        eventSubscription.current?.remove();
        eventSubscription.current = null;
        
        try {
            if (VolumeButtonNative && typeof VolumeButtonNative.stop === 'function') {
                VolumeButtonNative.stop();
            }
        } catch (error) {
            // Ignore stop errors
        }
        setIsActive(false);
    }, []);

    // Mount/unmount lifecycle - simplified to avoid infinite loops
    useEffect(() => {
        let mounted = true;

        console.log('[useHardwareVolumeButtons] Mounted:', mounted);
        
        const startListener = () => {
            if (!mounted || !isSupported || !volumeEventEmitter || !VolumeButtonNative) {
                console.warn('[useHardwareVolumeButtons] Cannot start: missing dependencies');
                return;
            }
            
            // Clean up existing subscription
            eventSubscription.current?.remove();
            
            try {
                console.log('[useHardwareVolumeButtons] Starting native module...');
                VolumeButtonNative.start();
                
                // Set initial volume to 50% to ensure we can detect both up and down
                if (typeof VolumeButtonNative.setVolume === 'function') {
                    VolumeButtonNative.setVolume(0.5);
                    console.log('[useHardwareVolumeButtons] Set initial volume to 50%');
                }
                
                // Subscribe to events
                eventSubscription.current = volumeEventEmitter.addListener('HardwareVolumeButton', (volumeEvent) => {
                    if (mounted) {
                        console.log('[useHardwareVolumeButtons] Volume event received:', volumeEvent);
                        setLastVolumeEvent(volumeEvent);
                        onPress?.(volumeEvent);
                    }
                });
                
                setIsActive(true);
                console.log('[useHardwareVolumeButtons] Successfully started');
                
                // Configure swallow changes after starting
                if (swallowChanges && typeof VolumeButtonNative.setSwallowVolumeChanges === 'function') {
                    VolumeButtonNative.setSwallowVolumeChanges(true);
                    console.log('[useHardwareVolumeButtons] Swallow changes enabled');
                }
                
            } catch (error) {
                console.error('[useHardwareVolumeButtons] Failed to start:', error);
                setIsActive(false);
            }
        };
        
        const stopListener = () => {
            eventSubscription.current?.remove();
            eventSubscription.current = null;
            
            try {
                if (VolumeButtonNative && typeof VolumeButtonNative.stop === 'function') {
                    VolumeButtonNative.stop();
                }
            } catch (error) {
                // Ignore stop errors
            }
            setIsActive(false);
        };
        
        // Auto start if enabled
        if (autoStart && isSupported) {
            startListener();
        }
        
        // Handle app state changes
        let appStateSubscription = null;
        if (autoPauseInBackground && isSupported) {
            appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
                if (!mounted) return;
                
                const wasInBackground = currentAppState.current.match(/inactive|background/);
                const isBecomingActive = nextAppState === 'active';
                const wasActive = currentAppState.current === 'active';
                const isGoingToBackground = nextAppState.match(/inactive|background/);
                
                if (wasInBackground && isBecomingActive && autoStart) {
                    startListener();
                } else if (wasActive && isGoingToBackground) {
                    stopListener();
                }
                currentAppState.current = nextAppState;
            });
        }
        
        // Cleanup on unmount
        return () => {
            mounted = false;
            stopListener();
            appStateSubscription?.remove();
        };
    }, [autoStart, autoPauseInBackground, isSupported, swallowChanges]); // Removed callback dependencies

    return {
        isSupported,
        isActive,
        lastEvent: lastVolumeEvent,
        start: startVolumeButtonListener,
        stop: stopVolumeButtonListener,
    };
}