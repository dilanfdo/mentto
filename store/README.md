# Store graphics

Everything uploaded to the Google Play listing.

```
store/
  build_icons.py                  renders every app icon from one vector design (see below)
  icon-512.png                    Play Console icon (512×512)
  feature-graphic-1024x500.png    Play feature graphic
  source/                         raw 1080×2424 emulator captures of the app with demo data
  screenshots/phone/              1080×1920  01-today … 08-reminders-backup
  screenshots/tablet-7in/         1200×1920
  screenshots/tablet-10in/        1600×2560
  build_screenshots.py            renders the panels and the feature graphic from source/
  seed_demo.mjs                   builds the demo database the captures are taken with
```

Both build scripts need Google Chrome (headless) at `/Applications/Google Chrome.app`.

## Icons

```bash
python3 store/build_icons.py
```

One design (a rounded white "M" with an amber reminder dot on an indigo gradient) is rendered to the
app icon, the adaptive-icon layers (mark kept inside the 66% safe zone so round and squircle launchers
don't crop it), the themed monochrome icon, the notification icon, the splash icon, the favicon and
the Play icon. After changing icons, run `npx expo prebuild --platform android` so the native
resources are regenerated, then rebuild.

## Screenshots

```bash
python3 store/build_screenshots.py
```

Headlines, sublines, gradients and floating tiles are in the `PANELS` list at the top of the script.
All three sizes render from the same captures, using the same layout as Huffle's listing.

## Refreshing the captures

1. Build the demo database (dates are relative to today; best run on a weekday around midday so
   the morning lessons are done and the afternoon is ahead):
   `node store/seed_demo.mjs /tmp/demo.db`
2. Install a debug build on the Pixel emulator (`npx expo run:android --device Pixel_9a_Edited`),
   force-stop it, and copy the database in:
   ```bash
   adb push /tmp/demo.db /data/local/tmp/mentto-demo.db
   adb shell "run-as app.nexusdigitallabs.mentto sh -c 'rm -f files/SQLite/mentto.db-wal files/SQLite/mentto.db-shm && cp /data/local/tmp/mentto-demo.db files/SQLite/mentto.db'"
   adb shell pm grant app.nexusdigitallabs.mentto android.permission.POST_NOTIFICATIONS
   adb shell appops set app.nexusdigitallabs.mentto SCHEDULE_EXACT_ALARM allow
   ```
3. Use light mode and a clean status bar (Android demo mode: clock, full battery and Wi-Fi, no
   notification icons), then capture each screen with `adb exec-out screencap -p` into `source/`
   under the names `today`, `schedule` (a day with a group class and a one-off lesson), `attendance`
   (today's group lesson with some students marked), `student`, `fees`, `plan` (a new per-term plan),
   `students` and `settings`. The debug build's own status-bar notification icon has to be painted
   out (it isn't hidden by demo mode).
4. Run `python3 store/build_screenshots.py`.
