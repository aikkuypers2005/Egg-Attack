// One call for Audio.pde. Processing's reader of .pde tabs does not accept a method that is called "open"
// (a word Java sets aside for modules), so this call is in a plain Java file, which Processing compiles as it is.

import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.LineUnavailableException;
import javax.sound.sampled.SourceDataLine;

public class LineOpener {
  public static void openLine(SourceDataLine line, AudioFormat format, int bufferBytes) throws LineUnavailableException {
    line.open(format, bufferBytes);
  }
}
