package app.nexusdigitallabs.exactalarms

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android 12+ only fires reminders at the exact minute when the user grants "Alarms & reminders".
// Without it, AlarmManager may deliver them up to an hour late.
class ExactAlarmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExactAlarms")

    Function("canScheduleExactAlarms") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function true
      val context = appContext.reactContext ?: return@Function false
      val alarms = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return@Function false
      alarms.canScheduleExactAlarms()
    }

    Function("openSettings") {
      val context = appContext.reactContext
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && context != null) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }
  }
}
