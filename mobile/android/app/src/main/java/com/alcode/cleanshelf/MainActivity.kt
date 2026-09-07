package com.alcode.cleanshelf

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(CleanShelfPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
