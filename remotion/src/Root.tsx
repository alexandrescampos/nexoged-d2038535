import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 5 scenes: 150 + 210 + 240 + 300 + 150 = 1050 frames
// minus 4 transitions of 20 frames each = 1050 - 80 = 970 frames (~32s at 30fps)
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={970}
    fps={30}
    width={1920}
    height={1080}
  />
);
