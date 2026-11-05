package app.nexusdigitallabs.restorekey

import android.content.Context
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CreateRestoreCredentialRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetRestoreCredentialOption
import androidx.credentials.RestoreCredential
import androidx.credentials.exceptions.NoCredentialException
import androidx.credentials.exceptions.restorecredential.E2eeUnavailableException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.SecureRandom
import org.json.JSONArray
import org.json.JSONObject

private const val TAG = "RestoreKey"
private const val RP_ID = "nexusdigitallabs.dev"
private const val MIN_SDK = Build.VERSION_CODES.P
private const val MAX_USER_ID_BYTES = 64 // WebAuthn's limit on user.id

// Play's zero-tap sign-in restoration, using Credential Manager's restore keys. A key is normally
// proved to the app's server; Mentto has none, and the key grants nothing by itself. It only says
// which account to use: the Drive token still comes from Google, for an account on the phone.
// The account travels in user.id and comes back as userHandle. Nothing leaves the device here.
//
// Both markers live in noBackupFilesDir so they stay behind when Android moves the app to a new phone.
class RestoreKeyModule : Module() {
  private val context: Context?
    get() = appContext.reactContext

  override fun definition() = ModuleDefinition {
    Name("RestoreKey")

    AsyncFunction("save") Coroutine { email: String ->
      val ctx = context ?: return@Coroutine false
      if (Build.VERSION.SDK_INT < MIN_SDK) return@Coroutine false
      val marker = savedMarker(ctx)
      if (marker.exists() && marker.readText() == email) return@Coroutine true
      val userId = email.toByteArray()
      if (userId.size > MAX_USER_ID_BYTES) return@Coroutine false
      try {
        val manager = CredentialManager.create(ctx)
        val json = creationJson(email, userId)
        try {
          manager.createCredential(ctx, CreateRestoreCredentialRequest(json, isCloudBackupEnabled = true))
        } catch (_: E2eeUnavailableException) {
          // No Google backup or screen lock: the key can still move by cable.
          manager.createCredential(ctx, CreateRestoreCredentialRequest(json, isCloudBackupEnabled = false))
        }
        marker.writeText(email)
        true
      } catch (e: Exception) {
        Log.w(TAG, "Could not save the restore key", e)
        false
      }
    }

    AsyncFunction("takeRestored") Coroutine { ->
      val ctx = context ?: return@Coroutine null
      if (Build.VERSION.SDK_INT < MIN_SDK) return@Coroutine null
      val marker = File(ctx.noBackupFilesDir, "restore_key_checked")
      if (marker.exists()) return@Coroutine null
      try {
        val option = GetRestoreCredentialOption(retrievalJson())
        val result = CredentialManager.create(ctx).getCredential(ctx, GetCredentialRequest(listOf(option)))
        marker.writeText("")
        (result.credential as? RestoreCredential)?.let { emailFrom(it.authenticationResponseJson) }
      } catch (_: NoCredentialException) {
        marker.writeText("")
        null
      } catch (e: Exception) {
        // Left unmarked, so the next launch looks again.
        Log.w(TAG, "Could not read the restore key", e)
        null
      }
    }

    AsyncFunction("clear") Coroutine { ->
      val ctx = context ?: return@Coroutine
      if (Build.VERSION.SDK_INT < MIN_SDK) return@Coroutine
      try {
        CredentialManager.create(ctx).clearCredentialState(
          ClearCredentialStateRequest(ClearCredentialStateRequest.TYPE_CLEAR_RESTORE_CREDENTIAL),
        )
        savedMarker(ctx).delete()
      } catch (e: Exception) {
        Log.w(TAG, "Could not delete the restore key", e)
      }
    }
  }

  private fun savedMarker(ctx: Context) = File(ctx.noBackupFilesDir, "restore_key_saved")

  private fun base64Url(bytes: ByteArray) =
    Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)

  private fun challenge() = base64Url(ByteArray(32).also { SecureRandom().nextBytes(it) })

  private fun creationJson(email: String, userId: ByteArray): String =
    JSONObject()
      .put("challenge", challenge())
      .put("rp", JSONObject().put("id", RP_ID).put("name", "Mentto"))
      .put("user", JSONObject().put("id", base64Url(userId)).put("name", email).put("displayName", email))
      .put(
        "pubKeyCredParams",
        JSONArray()
          .put(JSONObject().put("type", "public-key").put("alg", -7))
          .put(JSONObject().put("type", "public-key").put("alg", -257)),
      )
      .put("attestation", "none")
      .put("excludeCredentials", JSONArray())
      .put(
        "authenticatorSelection",
        JSONObject()
          .put("authenticatorAttachment", "platform")
          .put("requireResidentKey", true)
          .put("residentKey", "required")
          .put("userVerification", "required"),
      )
      .toString()

  private fun retrievalJson(): String =
    JSONObject()
      .put("challenge", challenge())
      .put("rpId", RP_ID)
      .put("allowCredentials", JSONArray())
      .put("userVerification", "required")
      .toString()

  private fun emailFrom(responseJson: String): String? {
    val handle = JSONObject(responseJson).getJSONObject("response").optString("userHandle")
    if (handle.isEmpty()) return null
    return String(Base64.decode(handle, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP))
  }
}
