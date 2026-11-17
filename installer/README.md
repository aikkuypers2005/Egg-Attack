# Windows installer (Inno Setup 6)

This folder has the Inno Setup 6 script `EggAttack.iss` and the icon `icon.ico` (16x16, 32x32, 48x48 and 256x256). Together with the exported Processing sketch they build `release\EggAttack-Setup-1.2.0.exe` (version 1.2.0: sound effects and music).

The sketch is `processing\EggAttack`. Its `data` folder holds the five JSON files written by `node tools\build_data.js` (with `WRITE_TO_PROCESSING = true`; `sfx.json` is the table of sound effects), the music loop `bassa-island-game-loop.wav` with its credit `MUSIC-CREDITS.txt` (CC BY 4.0: the credit has to stay with the game, and it is also shown on the controls screen), the headline font `PressStart2P-Regular.ttf` with its licence `OFL.txt` (the small text is a pixel font built into `Draw.pde`), `icon.png` and the 10 backdrops. Its `code` folder holds `jamepad.jar` (controllers); the export copies it to `lib`, and the installer takes everything in `lib`.

## Sound

`Audio.pde` is the port of `src\audio.js`. It uses only `javax.sound.sampled` (part of Java), no library. The effects are built from `data\sfx.json` with the same sums as the web version; the music file is repeated without a gap. One output line is opened when the window opens, and a thread of its own mixes the music and the effects into it. If there is no audio device, or anything else goes wrong with sound, the game runs silently. `test`, `shots` and `sheets` open no audio device.

`LineOpener.java` holds one call (`line.open(...)`): Processing does not accept a method called `open` in a `.pde` tab.

The test prints a line `SFXSUM ...` about all samples of all effects and compares it with the same line of the web version, which is stored in `Test.pde` as `SFX_SUM_WEB`. After a change to `data\sfx.json` or to the sums in `src\audio.js`, print the new line with `node installer\sfx_sum.js` and copy it there.

Differences from the web version: the time between two starts of the same sound (40 ms) is counted in game steps; the sound setting is not remembered after the game is closed; the music goes on when the window is not in front.

## How to rebuild the installer

Run these from the `egg-attack` folder. The `Processing.exe` launcher prints nothing in a script, so the commands call Processing's command-line class directly.

### 1. Check the sketch

```powershell
$app = "C:\Program Files\Processing\app"
$java = "$app\resources\jdk\bin\java.exe"
$cp = "$app\*;$app\resources\core\library\*;$app\resources\modes\java\mode\*;$app\resources\modes\java\application\launch4j\launch4j.jar;$app\resources\modes\java\application\launch4j\lib\xstream.jar"
& $java "-Dcompose.application.resources.dir=$app\resources" "-Dprocessing.version=4.4.10" -cp $cp processing.mode.java.Commander `
  --sketch="$PWD\processing\EggAttack" `
  --output="C:\Users\Aik Kuypers\.gemini\antigravity\scratch\egg-attack-pde-build" `
  --force --run test
```

`test` opens no window and no audio device, and prints PASS / FAIL lines. The four `FP ...` lines must be the same as those of `node tools\fingerprint.js`. Other arguments: `shots <folder>` (screenshots without a window), `sheets <folder>` (sprite review pages and the page of the small font), `autoplay <folder>` (opens the window, presses keys from a script, saves what the window shows and a log, then closes; the log also says whether an audio line was opened, whether the music is running and which effects were started).

### 2. Export the sketch for Windows (64-bit)

```powershell
& $java "-Dcompose.application.resources.dir=$app\resources" "-Dprocessing.version=4.4.10" -cp $cp processing.mode.java.Commander `
  --sketch="$PWD\processing\EggAttack" `
  --output="C:\Users\Aik Kuypers\.gemini\antigravity\scratch\EggAttack-Windows" `
  --force --variant=windows-amd64 --export
```

### 3. Put `icon.ico` into the exported `EggAttack.exe`

Processing's export gives the launcher its own icon. This step builds the launcher again with Processing's bundled Launch4j and our icon:

```powershell
$l4jDir = "C:\Program Files\Processing\app\resources\modes\java\application\launch4j"
$expDir = "C:\Users\Aik Kuypers\.gemini\antigravity\scratch\EggAttack-Windows"
$icoPath = "$PWD\installer\icon.ico"
$jars = Get-ChildItem "$expDir\lib\*.jar" | ForEach-Object { "    <cp>%EXEDIR%\lib\$($_.Name)</cp>" }
$xml = @"
<launch4jConfig>
  <headerType>gui</headerType>
  <dontWrapJar>true</dontWrapJar>
  <chdir>.</chdir>
  <downloadUrl>https://adoptium.net/</downloadUrl>
  <outfile>$expDir\EggAttack.exe</outfile>
  <icon>$icoPath</icon>
  <classPath>
    <mainClass>EggAttack</mainClass>
$($jars -join "`r`n")
  </classPath>
  <jre>
    <path>java;%PATH%</path>
    <minVersion>17</minVersion>
    <opt>-Djna.nosys=true</opt>
    <opt>-Djava.library.path="%EXEDIR%\lib"</opt>
  </jre>
</launch4jConfig>
"@
Set-Content -Path "$expDir\launch4j-custom.xml" -Value $xml -Encoding UTF8
& "C:\Program Files\Processing\app\resources\jdk\bin\java.exe" -cp "$l4jDir\launch4j.jar;$l4jDir\lib\xstream.jar" net.sf.launch4j.Main "$expDir\launch4j-custom.xml"
Remove-Item "$expDir\launch4j-custom.xml"
```

The exported application can be checked with its own Java, without a window:

```powershell
& "$expDir\java\bin\java.exe" "-Djna.nosys=true" "-Djava.library.path=$expDir\lib" -cp "$expDir\lib\*" EggAttack test
```

`EggAttack.exe` starts `java\bin\javaw.exe` and then ends itself, so the game's window belongs to a `javaw.exe` process, not to a process called `EggAttack`.

### 4. Build `EggAttack-Setup-1.2.0.exe` with Inno Setup (`ISCC.exe`)

```powershell
& "C:\Users\Aik Kuypers\.gemini\antigravity\scratch\tools\InnoSetup\ISCC.exe" `
  "/DExportDir=C:\Users\Aik Kuypers\.gemini\antigravity\scratch\EggAttack-Windows" `
  "/DOutputDir=$PWD\release" `
  "installer\EggAttack.iss"
```

This writes `release\EggAttack-Setup-1.2.0.exe`. The installer puts the game in `%LOCALAPPDATA%\Programs\Egg Attack` (no administrator rights needed) and can make a desktop shortcut. The AppId is the same as in 1.1.0, so it installs over an installed 1.1.0. It has its own AppId, so it installs next to an older Dino Nest, not over it.
