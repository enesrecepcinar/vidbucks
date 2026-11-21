// Registry of the templates: one demo composition each. Copy a demo config (demos.ts), change the content, add a line here.
import React from "react";
import { Composition } from "remotion";
import { IconStory } from "./IconStory";
import { ObjectStory } from "./ObjectStory";
import { KineticType, kineticDuration } from "./KineticType";
import { ParticleBloom } from "./ParticleBloom";
import { dollarLira } from "./dollarLira";
import { HoloPromo } from "./HoloPromo";
import { dolarPromo } from "./dolarPromo";
import { AiAgents, AI_AGENTS_SEC } from "./AiAgents";
import { LaptopGlass, LAPTOP_SEC } from "./LaptopGlass";
import { JericoLaptop } from "./JericoLaptop";
import { JericoCinematic, CINE_SEC } from "./JericoCinematic";
import { iconStoryDemo, kineticDemo, objectStoryDemo, particleDemo } from "./demos";
import { BoardFilm } from "../kits/board/BoardFilm";
import { boardDemo, boardDemoTiming } from "../kits/board/demo";
import { LayerScene, layerDuration } from "../kits/layers/LayerScene";
import { layerDemo } from "../kits/layers/demo";
import { SwissDance } from "../kits/swiss/Swiss";
import { swissDemoTiming } from "../kits/swiss/demo";
import { MultiStyle } from "../kits/multi/MultiStyle";
import { multiEdit, multiEditMany, multiTiming } from "../kits/multi/demo";
import { ShotFilm } from "../kits/shots/ShotFilm";
import { shotTiming, shotVisuals } from "../kits/shots/demo";
import { films } from "../kits/shots/films";
import { HeroTest } from "../kits/bunker/HeroTest";
import { FootageEdit, type FootageProps } from "../kits/footage/FootageEdit";
import { CardGallery } from "../kits/cards/Cards";
import { MediaReel, MediaGallery, reelLength } from "../kits/media/Media";
import { MediaSceneDemo, IconSheet } from "../kits/media/MediaScene";
import { ChatStory, DEMO_CHAT } from "../kits/chat/ChatStory";
import { MorphDemo } from "../kits/media/Bridge";
import { VidbucksPromo, PROMO_LEN } from "../kits/promo/VidbucksPromo";
import { VidbucksPromo2, PROMO2_LEN } from "../kits/promo/VidbucksPromo2";
import { VidbucksPromo3, PROMO3_LEN } from "../kits/promo/VidbucksPromo3";
import { VidbucksPromo4, PROMO4_LEN } from "../kits/promo/VidbucksPromo4";
import { ClipVlog } from "../kits/vlog/ClipVlog";
import { AdSpot, DEMO_AD, AD_LEN } from "../kits/ad/AdSpot";
import { LogoReveal, DEMO_LOGO } from "../kits/logo/LogoReveal";
import { StormWorld, DEMO_STORM, stormLength } from "../kits/storm/StormWorld";
import { ArchiveDoc, DEMO_ARCHIVE, archiveLength } from "../kits/archive/ArchiveDoc";
import { Whiteboard, DEMO_WB, boardLength } from "../kits/media/Whiteboard";
import { DataRace, DEMO_RACE, raceLength } from "../kits/data/DataRace";
import { Countdown, DEMO_COUNT, countLength } from "../kits/list/Countdown";
import { GymEdit, GYM_DURATION } from "../kits/gym/GymEdit";
import { GymTech, TECH_DURATION } from "../kits/gym/GymTech";
import { BunkerDemo, BUNKER_DURATION } from "../kits/bunker/BunkerDemo";
import { NewsFilm, newsLength } from "../kits/news/NewsFilm";
import { NSA_CFG } from "../kits/news/nsa_cfg";

export const TemplateCompositions: React.FC = () => (
  <>
    <Composition id="Tpl-IconStory" component={IconStory as React.FC<any>} defaultProps={{ cfg: iconStoryDemo }} width={iconStoryDemo.width} height={iconStoryDemo.height} fps={iconStoryDemo.fps} durationInFrames={Math.round(iconStoryDemo.durationSec * iconStoryDemo.fps)} />
    <Composition id="Tpl-ObjectStory" component={ObjectStory as React.FC<any>} defaultProps={{ cfg: objectStoryDemo }} width={objectStoryDemo.width} height={objectStoryDemo.height} fps={objectStoryDemo.fps} durationInFrames={Math.round(objectStoryDemo.durationSec * objectStoryDemo.fps)} />
    <Composition id="Tpl-KineticType-Vertical" component={KineticType as React.FC<any>} defaultProps={{ cfg: kineticDemo }} width={kineticDemo.width} height={kineticDemo.height} fps={kineticDemo.fps} durationInFrames={kineticDuration(kineticDemo)} />
    <Composition id="Tpl-KineticType-Horizontal" component={KineticType as React.FC<any>} defaultProps={{ cfg: { ...kineticDemo, width: 1920, height: 1080 } }} width={1920} height={1080} fps={kineticDemo.fps} durationInFrames={kineticDuration(kineticDemo)} />
    <Composition id="Tpl-ParticleBloom" component={ParticleBloom as React.FC<any>} defaultProps={{ cfg: particleDemo }} width={particleDemo.width} height={particleDemo.height} fps={particleDemo.fps} durationInFrames={Math.round(particleDemo.durationSec * particleDemo.fps)} />
    <Composition id="Tpl-BoardFilm" component={BoardFilm as React.FC<any>} defaultProps={{ cfg: boardDemo, timing: boardDemoTiming }} width={1920} height={1080} fps={30} durationInFrames={Math.round(boardDemoTiming.duration * 30)} />
    <Composition id="Tpl-LayerScene" component={LayerScene as React.FC<any>} defaultProps={{ cfg: layerDemo }} width={1920} height={1080} fps={30} durationInFrames={Math.round(layerDuration(layerDemo) * 30)} />
    <Composition id="Tpl-SwissDance" component={SwissDance as React.FC<any>} defaultProps={{ timing: swissDemoTiming }} width={1920} height={1080} fps={24} durationInFrames={Math.round(swissDemoTiming.duration * 24)} />
    <Composition id="Tpl-MultiStyle" component={MultiStyle as React.FC<any>} defaultProps={{ edit: multiEdit, timing: multiTiming }} width={1920} height={1080} fps={30} durationInFrames={Math.round(multiTiming.duration * 30)} calculateMetadata={({ props }: { props: any }) => ({ durationInFrames: Math.round(props.timing.duration * 30), width: props.edit.width ?? 1920, height: props.edit.height ?? 1080 })} />
    <Composition id="Tpl-MultiStyle-Many" component={MultiStyle as React.FC<any>} defaultProps={{ edit: multiEditMany, timing: multiTiming }} width={1920} height={1080} fps={30} durationInFrames={Math.round(multiTiming.duration * 30)} />
    <Composition id="Tpl-ShotFilm" component={ShotFilm as React.FC<any>} defaultProps={{ visuals: shotVisuals, timing: shotTiming }} width={1920} height={1080} fps={30} durationInFrames={Math.round(shotTiming.duration * 30)} />
    <Composition id="MediaReel" component={MediaReel} width={1920} height={1080} fps={30} durationInFrames={Math.round(reelLength() * 30)} />
    <Composition id="MediaScene-demo" component={MediaSceneDemo as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={330} defaultProps={{ medium: "crosshatch" }} />
    <Composition id="MediaScene-demo-v" component={MediaSceneDemo as React.FC<any>} width={1080} height={1920} fps={30} durationInFrames={330} defaultProps={{ medium: "cut-paper" }} />
    <Composition id="MediaIconSheet" component={IconSheet as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={1} defaultProps={{ medium: "crosshatch" }} />
    <Composition id="ChatStory" component={ChatStory as React.FC<any>} width={1080} height={1920} fps={30} durationInFrames={210} defaultProps={{ cfg: DEMO_CHAT }} calculateMetadata={({ props }: { props: any }) => ({ durationInFrames: Math.round(props.cfg.duration * 30), ...(props.size ? { width: props.size[0], height: props.size[1] } : {}) })} />
    <Composition id="DataRace" component={DataRace as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={Math.round(raceLength(DEMO_RACE) * 30)} defaultProps={{ cfg: DEMO_RACE }} calculateMetadata={({ props }: { props: any }) => ({ durationInFrames: Math.round(raceLength(props.cfg) * 30), ...(props.size ? { width: props.size[0], height: props.size[1] } : {}) })} />
    <Composition id="Countdown" component={Countdown as React.FC<any>} width={1080} height={1920} fps={30} durationInFrames={Math.round(countLength(DEMO_COUNT) * 30)} defaultProps={{ cfg: DEMO_COUNT }} calculateMetadata={({ props }: { props: any }) => ({ durationInFrames: Math.round(countLength(props.cfg) * 30), ...(props.size ? { width: props.size[0], height: props.size[1] } : {}) })} />
    <Composition id="MorphDemo" component={MorphDemo} width={1920} height={1080} fps={30} durationInFrames={150} />
    <Composition id="Whiteboard" component={Whiteboard as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={Math.round(boardLength(DEMO_WB) * 30)} defaultProps={{ cfg: DEMO_WB }} calculateMetadata={({ props }: { props: any }) => ({ durationInFrames: Math.round(boardLength(props.cfg) * 30) })} />
    <Composition id="AdSpot" component={AdSpot as React.FC<any>} width={1080} height={1920} fps={30} durationInFrames={AD_LEN * 30} defaultProps={DEMO_AD} calculateMetadata={({ props }: { props: any }) => (props.size ? { width: props.size[0], height: props.size[1] } : {})} />
    <Composition id="ArchiveDoc" component={ArchiveDoc as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={Math.round(archiveLength(DEMO_ARCHIVE) * 30)} defaultProps={{ cfg: DEMO_ARCHIVE }} calculateMetadata={({ props }: { props: any }) => ({ durationInFrames: Math.round(archiveLength(props.cfg) * 30), ...(props.size ? { width: props.size[0], height: props.size[1] } : {}) })} />
    <Composition id="StormWorld" component={StormWorld as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={Math.round(stormLength(DEMO_STORM) * 30)} defaultProps={{ cfg: DEMO_STORM }} calculateMetadata={({ props }: { props: any }) => ({ durationInFrames: Math.round(stormLength(props.cfg) * 30), ...(props.size ? { width: props.size[0], height: props.size[1] } : {}) })} />
    <Composition id="LogoReveal" component={LogoReveal as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={135} defaultProps={{ logo: DEMO_LOGO }} calculateMetadata={({ props }: { props: any }) => ({ durationInFrames: Math.round((props.duration ?? 4.5) * 30), ...(props.size ? { width: props.size[0], height: props.size[1] } : {}) })} />
    <Composition id="ClipVlog" component={ClipVlog as React.FC<any>} width={1080} height={1920} fps={30} durationInFrames={300} defaultProps={{ cfg: { segments: [], captions: [], duration: 10 } }} calculateMetadata={({ props }: { props: any }) => ({ durationInFrames: Math.round(props.cfg.duration * 30) })} />
    <Composition id="VidbucksPromo" component={VidbucksPromo as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={PROMO_LEN * 30} defaultProps={{}} calculateMetadata={({ props }: { props: any }) => (props.size ? { width: props.size[0], height: props.size[1] } : {})} />
    <Composition id="VidbucksPromo2" component={VidbucksPromo2 as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={PROMO2_LEN * 30} defaultProps={{}} calculateMetadata={({ props }: { props: any }) => (props.size ? { width: props.size[0], height: props.size[1] } : {})} />
    <Composition id="VidbucksPromo3" component={VidbucksPromo3 as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={PROMO3_LEN * 30} defaultProps={{}} calculateMetadata={({ props }: { props: any }) => (props.size ? { width: props.size[0], height: props.size[1] } : {})} />
    <Composition id="VidbucksPromo4" component={VidbucksPromo4 as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={PROMO4_LEN * 30} defaultProps={{}} calculateMetadata={({ props }: { props: any }) => (props.size ? { width: props.size[0], height: props.size[1] } : {})} />
    <Composition id="MediaGallery" component={MediaGallery as React.FC<any>} width={1920} height={760} fps={30} durationInFrames={1} defaultProps={{ t: 2.8 }} />
    <Composition id="CardGallery" component={CardGallery as React.FC<any>} width={1920} height={2920} fps={30} durationInFrames={1} defaultProps={{}} />
    <Composition id="FootageEdit" component={FootageEdit as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={30}
      defaultProps={{ video: "edits/sample/cut.mp4", words: [], duration: 1, fps: 30, size: [1920, 1080], captions: "sentence", overlays: [] } as FootageProps}
      calculateMetadata={({ props }) => { const p = props as unknown as FootageProps; return { durationInFrames: Math.max(1, Math.round(p.duration * p.fps)), fps: p.fps, width: p.size[0], height: p.size[1] }; }} />
    <Composition id="NSA-News" component={NewsFilm as React.FC<any>} width={1920} height={1080} fps={30} durationInFrames={newsLength(NSA_CFG)} defaultProps={{ cfg: NSA_CFG }} />
    <Composition id="Bunker-demo" component={BunkerDemo} width={1920} height={1080} fps={30} durationInFrames={Math.round(BUNKER_DURATION * 30)} />
    <Composition id="Gym-tech" component={GymTech} width={1080} height={1920} fps={30} durationInFrames={Math.round(TECH_DURATION * 30)} />
    <Composition id="Gym-edit" component={GymEdit} width={1080} height={1920} fps={30} durationInFrames={Math.round(GYM_DURATION * 30)} />
    <Composition id="Bunker-herotest" component={HeroTest} width={1920} height={1080} fps={30} durationInFrames={60} />
    {films.map((f) => <Composition key={f.slug} id={`Film-${f.slug}`} component={ShotFilm as React.FC<any>} defaultProps={{ visuals: f.visuals, timing: f.timing }} width={1920} height={1080} fps={30} durationInFrames={Math.round(f.timing.duration * 30)} />)}
    <Composition id="DollarLira" component={ObjectStory as React.FC<any>} defaultProps={{ cfg: dollarLira }} width={dollarLira.width} height={dollarLira.height} fps={dollarLira.fps} durationInFrames={Math.round(dollarLira.durationSec * dollarLira.fps)} />
    <Composition id="DolarPromo" component={HoloPromo as React.FC<any>} defaultProps={{ cfg: dolarPromo }} width={dolarPromo.width} height={dolarPromo.height} fps={dolarPromo.fps} durationInFrames={Math.round(dolarPromo.durationSec * dolarPromo.fps)} />
    <Composition id="AiAgents" component={AiAgents} width={1920} height={1080} fps={30} durationInFrames={AI_AGENTS_SEC * 30} />
    <Composition id="LaptopGlass" component={LaptopGlass} width={1920} height={1080} fps={30} durationInFrames={LAPTOP_SEC * 30} />
    <Composition id="JericoLaptop" component={JericoLaptop} width={1920} height={1080} fps={30} durationInFrames={LAPTOP_SEC * 30} />
    <Composition id="JericoCinematic" component={JericoCinematic} width={3840} height={2160} fps={30} durationInFrames={Math.round(CINE_SEC * 30)} />
  </>
);
