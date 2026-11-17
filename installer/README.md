# Windows installer (Inno Setup 6)

This folder has the Inno Setup 6 script `EggAttack.iss` and the icon `icon.ico` (16x16, 32x32, 48x48 and 256x256). Together with the exported Processing sketch they build `release\EggAttack-Setup-1.1.0.exe`.

The sketch is `processing\EggAttack`. Its `data` folder holds the four JSON files written by `node tools\build_data.js` (with `WRITE_TO_PROCESSING = true`), the headline font `PressStart2P-Regular.ttf` with its licence `OFL.txt` (the small text is a pixel font built into `Draw.pde`), `icon.png` and the 10 backdrops. Its `code` folder holds `jamepad.jar` (controllers); the export copies it to `lib`, and the installer takes everything in `lib`.

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

`test` opens no window and prints PASS / FAIL lines. The four `FP ...` lines must be the same as those of `node tools\fingerprint.js`. Other arguments: `shots <folder>` (screenshots without a window), `sheets <folder>` (sprite review pages and the page of the small font), `autoplay <folder>` (opens the window, presses keys from a script, saves what the window shows and a log, then closes).

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

### 4. Build `EggAttack-Setup-1.1.0.exe` with Inno Setup (`ISCC.exe`)

```powershell
& "C:\Users\Aik Kuypers\.gemini\antigravity\scratch\tools\InnoSetup\ISCC.exe" `
  "/DExportDir=C:\Users\Aik Kuypers\.gemini\antigravity\scratch\EggAttack-Windows" `
  "/DOutputDir=$PWD\release" `
  "installer\EggAttack.iss"
```

This writes `release\EggAttack-Setup-1.1.0.exe`. The installer puts the game in `%LOCALAPPDATA%\Programs\Egg Attack` (no administrator rights needed) and can make a desktop shortcut. It has its own AppId, so it installs next to an older Dino Nest, not over it.
