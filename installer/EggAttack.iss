; Inno Setup 6 script for Egg Attack (the Processing 4 version for Windows)

#ifndef ExportDir
  #define ExportDir "C:\Users\Aik Kuypers\.gemini\antigravity\scratch\EggAttack-Windows"
#endif

#ifndef OutputDir
  #define OutputDir "C:\Users\Aik Kuypers\.gemini\antigravity\scratch\egg-attack\release"
#endif

[Setup]
AppId={{C4AECAEF-A51E-4B68-A3FD-EF544A733E3F}
AppName=Egg Attack
AppVersion=1.2.0
AppVerName=Egg Attack 1.2.0
AppPublisher=Aik Kuypers & Job
DefaultDirName={localappdata}\Programs\Egg Attack
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog commandline
LicenseFile=..\LICENSE
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico
UninstallDisplayName=Egg Attack
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutputDir}
OutputBaseFilename=EggAttack-Setup-1.2.0

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "nl"; MessagesFile: "compiler:Languages\Dutch.isl"

[CustomMessages]
en.PlayNow=Play Egg Attack now
nl.PlayNow=Egg Attack nu spelen

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#ExportDir}\EggAttack.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion
; data: the JSON files (sfx.json: the sound effects), the music loop bassa-island-game-loop.wav with MUSIC-CREDITS.txt,
; the headline font (with its licence OFL.txt), icon.png and the backdrops
Source: "{#ExportDir}\data\*"; DestDir: "{app}\data"; Flags: ignoreversion recursesubdirs createallsubdirs
; lib: the game (EggAttack.jar), Processing's core, and jamepad.jar from the sketch's code folder (controllers)
Source: "{#ExportDir}\lib\*"; DestDir: "{app}\lib"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#ExportDir}\java\*"; DestDir: "{app}\java"; Excludes: "jmods\*,src.zip,ct.sym"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Egg Attack"; Filename: "{app}\EggAttack.exe"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\Egg Attack"; Filename: "{app}\EggAttack.exe"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\EggAttack.exe"; WorkingDir: "{app}"; Description: "{cm:PlayNow}"; Flags: nowait postinstall skipifsilent
