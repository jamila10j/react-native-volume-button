package com.volumebutton

import android.app.Activity
import android.content.Context
import android.media.AudioManager
import android.view.KeyEvent
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import android.os.Handler
import android.os.Looper

class VolumeButtonModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private val audioManager: AudioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var isListening = false
    private var swallowChanges = false
    private var lastVolume: Float = 0.5f
    private var lastEventTime: Long = 0
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val MODULE_NAME = "VolumeButton"
        private const val EVENT_NAME = "HardwareVolumeButton"
        private const val MIN_EVENT_INTERVAL = 100L // Minimum time between events in milliseconds
    }

    override fun getName(): String = MODULE_NAME

    @ReactMethod
    fun start() {
        if (isListening) return
        isListening = true
        
        // Set initial volume to 50%
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val initialVolume = (maxVolume * 0.5f).toInt()
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, initialVolume, 0)
        lastVolume = initialVolume.toFloat() / maxVolume
        
        // Note: Android volume button detection requires handling at the Activity level
        // This will be handled by overriding dispatchKeyEvent in MainActivity
    }

    @ReactMethod
    fun stop() {
        if (!isListening) return
        isListening = false
    }

    @ReactMethod
    fun setSwallowVolumeChanges(enable: Boolean) {
        swallowChanges = enable
    }

    @ReactMethod
    fun setVolume(level: Float) {
        val clampedLevel = level.coerceIn(0.0f, 1.0f)
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val volumeLevel = (maxVolume * clampedLevel).toInt()
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, volumeLevel, 0)
        lastVolume = clampedLevel
    }

    fun handleVolumeKeyEvent(keyCode: Int, event: KeyEvent): Boolean {
        if (!isListening) return false
        if (event.action != KeyEvent.ACTION_DOWN) return false
        
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastEventTime < MIN_EVENT_INTERVAL) {
            return swallowChanges // Debounce rapid events
        }
        lastEventTime = currentTime

        val direction = when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> "up"
            KeyEvent.KEYCODE_VOLUME_DOWN -> "down"
            else -> return false
        }

        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val currentVolumeFloat = currentVolume.toFloat() / maxVolume
        
        val params = Arguments.createMap().apply {
            putString("direction", direction)
            putDouble("oldValue", lastVolume.toDouble())
            putDouble("newValue", currentVolumeFloat.toDouble())
            putDouble("pressedAt", currentTime.toDouble())
        }

        // Send event to JS
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, params)

        if (swallowChanges) {
            // Restore previous volume
            mainHandler.postDelayed({
                val restoreVolume = (maxVolume * lastVolume).toInt()
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, restoreVolume, 0)
            }, 50) // Small delay to allow the event to propagate
            return true // Consume the event
        } else {
            lastVolume = currentVolumeFloat
            return false // Let the system handle the volume change
        }
    }

    fun getIsListening(): Boolean = isListening
}