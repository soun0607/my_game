// ============================================================
// ① 준비: 도화지(canvas)와 붓(ctx), 화면의 HTML 요소 가져오기
// ============================================================

const canvas = document.getElementById("game");  // 이름이 "game"인 도화지를 찾는다
const ctx = canvas.getContext("2d");             // 그 도화지에 그릴 "붓"을 가져온다

const syncSlider = document.getElementById("sync");          // 화면 아래 싱크 조절 막대 (index.html)
const syncValue = document.getElementById("sync-value");     // 싱크 값 글자

// ============================================================
// ② 상태 변수와 설정값 (여기 숫자만 바꾸면 화면과 난이도가 바뀐다)
// ============================================================

// ----- 화면 배치: 레인과 판정선 -----

// 레인: 가운데 세로 줄 4개
const LANE_X = 280;        // 첫 번째 레인의 왼쪽 x
const LANE_TOP = 150;      // 레인이 시작하는 y
const LANE_WIDTH = 60;     // 레인 한 칸의 너비
const LANE_HEIGHT = 380;   // 레인의 높이 (150 + 380 = 530까지)
const LANE_COUNT = 4;      // 레인 개수 (← ↓ ↑ →)

// 판정선: 노트가 여기 닿을 때 키를 누른다
const JUDGE_Y = 472;       // 판정선 y: A S K L 과녁 바로 위쪽 테두리에 놓는다 (판정 범위 띠·노트 타이밍·히트박스가 모두 이 선을 기준으로 따라 움직인다)
const TARGET_Y = 500;      // A S K L 과녁(판정 박스) 그림의 가운데 y. 과녁 그림은 이 자리에 그대로 둔다

const NOTE_SIZE = 50;      // 노트 그림 크기 (가로 = 세로)
const TARGET_SIZE = Math.round(NOTE_SIZE * 1.1 * 0.8);  // A S K L 과녁(판정 박스) 그림 크기: 55의 0.8배 = 44
const NOTE_BAR_HEIGHT = 14;   // 노트(가로 흰 사각형 막대)의 두께(px). 막대는 노트 자리(NOTE_SIZE) 가운데에 그린다
const KEY_GUIDE_SHOW_SECONDS = 0;   // 카운트다운이 끝나고 A S K L 과녁이 더 보이는 시간(초). 0이면 카운트다운이 끝나자마자 서서히 사라지기 시작한다
const KEY_GUIDE_FADE_SECONDS = 1;   // 사라지는 데 걸리는 시간(초)
const NOTE_END_Y = LANE_TOP + LANE_HEIGHT;    // 노트가 사라지는 y (레인 맨 아래). 노트 윗부분까지 이 선을 넘으면 줄 맨 뒤로 돌아간다

// ----- 노트 (배열): 간격, 개수, 처음 줄 세우기 -----

// 노트: lane = 몇 번째 레인(0~3), time = 판정선에 닿아야 하는 시각(음악 시작 후 몇 초), y = 지금 세로 위치
// 노트는 음악 박자(BPM)에 맞춰 "언제 판정선에 닿을지(time)"가 먼저 정해지고,
// y는 매 프레임 "지금 음악이 몇 초째인가"로 계산한다 → 음악과 노트가 어긋나지 않는다 (8장 BPM 맞추기)
const STAGE_BPMS = [101, 115, 140];          // 스테이지별 배경음악 BPM (README 에셋 표의 곡과 같다)
// 노트 사이 간격(박자)의 최소값과 최대값: 이 사이에서 무작위로 골라서, 간격이 너무 일정하지 않게 한다
// 간격은 GAP_STEP_BEATS(반 박) 단위로만 고른다 → 노트가 언제나 음악 박자(반 박 칸) 위에 떨어진다
const STAGE_MIN_GAP_BEATS = [1, 1, 0.5];     // 가장 촘촘할 때: 초급 1박 / 중급 1박 / 상급 반 박
const STAGE_MAX_GAP_BEATS = [2, 1.5, 1.5];   // 가장 띄엄띄엄할 때: 초급 2박 / 중급 1.5박 / 상급 1.5박
const GAP_STEP_BEATS = 0.5;                  // 간격을 고르는 단위 (반 박)
let bpm = STAGE_BPMS[0];                     // 지금 스테이지의 BPM
let minGapBeats = STAGE_MIN_GAP_BEATS[0];   // 지금 스테이지의 최소 간격(박자)
let maxGapBeats = STAGE_MAX_GAP_BEATS[0];   // 지금 스테이지의 최대 간격(박자)
const SONG_OFFSET = 0;     // 곡의 첫 박이 몇 초에 시작하는가. 노트가 음악보다 계속 빠르거나 늦게 느껴지면 이 값을 조금씩 바꾼다
const NOTE_COUNT = 11;     // 화살표 노트 개수. 레인을 다 채우고도 위에서 기다리는 노트가 남을 만큼 넉넉하게
                           // (모자라면 줄 맨 뒤가 비어서 동시 노트가 만들어지지 않는다)

let notes = [];            // 화살표 노트들 (시작할 때 createNotes()로 채운다)
let spaceNoteTime = 0;     // Space 노트가 판정선에 닿아야 하는 시각(초)
let spaceNoteY = -1000;    // Space 노트(레인 4개를 가로지르는 긴 막대)의 y. 매 프레임 spaceNoteTime으로 계산한다
let nextSlotTime = 0;      // 다음 노트가 들어갈 박자 칸의 시각(초). 노트를 하나 배치할 때마다 한 칸씩 뒤로 간다
let lastSlot = null;       // 마지막으로 배치한 박자 칸 { time, lane, count(그 칸의 노트 수), space(Space 노트인가) }

const CHORD_CHANCE = 0.2;  // 동시 노트(두 키를 같이 눌러야 하는 노트)가 나올 확률 (0.2 = 20%)

// 스테이지별 노트 속도 (속도 튜닝으로 정함): 초급 4 / 중급 4 / 상급 5 (1초 60프레임 기준 한 프레임에 내려오는 px)
const STAGE_SPEEDS = [4, 4, 5];
let noteSpeed = STAGE_SPEEDS[0];   // 지금은 스테이지 1(초급). 1초에 noteSpeed × 60 px 내려온다

// ----- 입력과 판정 (5장) -----

const INPUT_MODE = "B";    // 조작 방식. "A" = 키 이벤트 안에서 바로 판정 (비교 실험용), "B" = keys에 기록하고 게임 루프에서 판정
const JUDGE_RANGE = 70;    // 노트 가운데가 판정선에서 이 거리(px) 안에 있을 때 키를 누르면 판정한다 (MISS 구간을 넓히려고 50 → 70)
// 조작키: 플레이테스트 피드백으로 방향키 대신 A S K L (왼손 두 손가락 + 오른손 두 손가락)
const KEY_TO_LANE = { a: 0, s: 1, k: 2, l: 3 };  // 키 → 레인 번호 (레인 순서: ← ↓ ↑ →)
const GAME_KEYS = ["a", "s", "k", "l", " "];   // 게임에 쓰는 키 (" "는 스페이스바)
const LANE_KEY_LABELS = ["A", "S", "K", "L"];  // 레인 아래에 보여 줄 키 이름

const keys = {};           // 지금 눌려 있는 키를 적어 두는 메모장 (true = 눌림, false = 안 눌림)
const prevKeys = {};       // 지난 프레임에 눌려 있던 키 (이번 프레임에 "새로" 눌렸는지 알아내는 데 쓴다)
let playerPose = "player"; // 지금 내 캐릭터가 하고 있는 포즈 (그림 이름)

// ----- 싱크 조절 (플레이테스트 피드백) -----

// 싱크 = 판정 기준을 몇 ms 늦게(+) 또는 일찍(-) 잡을지. 화면보다 손이 늦거나 빠른 사람을 위해 맞춘다
// +면 판정 기준이 판정선보다 아래로 내려가서 조금 늦게 눌러도 정확하게 판정된다
const SYNC_MIN = -150;     // 싱크 막대 최소값 (ms)
const SYNC_MAX = 150;      // 싱크 막대 최대값 (ms)
let syncMs = 0;            // 지금 싱크 값 (ms)
try {
  syncMs = Number(localStorage.getItem("syncMs")) || 0;   // 지난번에 맞춘 값을 이 브라우저에서 기억해 둔다
} catch (e) {
  syncMs = 0;              // 저장소를 못 쓰는 환경이면 0으로
}

// ----- 판정 등급과 이펙트 -----

// 판정 등급: 정확도 = 판정선에 얼마나 가깝게 눌렀는가 (판정선 한가운데 100%, 판정 범위 끝 0%)
const PERFECT_ACCURACY = 0.86;  // 86% 이상 → PERFECT (판정선에서 약 10px 안)
const GREAT_ACCURACY = 0.69;    // 69% 이상 ~ 86% 미만 → GREAT (약 21.7px 안)
const MISS_ACCURACY = 0.43;     // 43% 이상 ~ 69% 미만 → GOOD (약 39.9px 안), 43% 미만 → MISS (약 40 ~ 70px: 너무 일찍/늦게 눌렀다)
const JUDGE_SHOW_FRAMES = 40;   // 판정 글자를 화면에 띄워 두는 시간 (프레임 수, 60 = 약 1초)
let judgeText = "";        // 지금 띄울 판정 글자 ("PERFECT" / "GREAT" / "GOOD" / "MISS")
let judgeTimer = 0;        // 판정 글자가 사라지기까지 남은 프레임 수
const MISS_FLASH_FRAMES = 20;   // MISS 때 레인 전체가 어두운 빨강으로 번쩍이는 시간 (프레임 수, 60 = 약 1초)
let missFlashTimer = 0;    // 빨간 번쩍임이 사라지기까지 남은 프레임 수
const JUDGE_COLORS = { PERFECT: "#ffd166", GREAT: "#8fd3ff", GOOD: "#b8f2a0", MISS: "#ff6b6b" }; // 판정별 색 (글자와 이펙트에 같이 쓴다)

// 입력 이펙트
const HIT_EFFECT_FRAMES = 20;  // 맞췄을 때 터지는 이펙트가 보이는 시간 (프레임 수)
let hitEffects = [];       // 지금 화면에 보이는 이펙트 목록. 하나 = { x, y, color, wide, timer }

// ----- 충돌 판정 (6장)과 디버그 표시 (7장) -----

const SHOW_JUDGE_RANGE = true;   // true면 판정선 둘레에 판정 범위(PERFECT · GREAT · GOOD · MISS 구간)를 색 띠로 보여 준다
let showHitbox = false;     // true면 판정 영역과 노트 판정 영역을 빨간 테두리로 그린다 (확인이 끝나면 false로 끈다)
let showDebug = false;      // true면 왼쪽 위에 디버그 정보를 띄우고, 히트박스도 함께 그린다. D 키로 켜고 끈다 (제출할 때는 false)
const NOTE_HITBOX_HEIGHT = 10;  // 노트 판정용 사각형의 세로 크기. 그림(50)보다 얇게, 노트 가운데에 둔다
                                // (그림 전체로 판정하면 노트 끝만 걸쳐도 맞은 것이 되어서, 판정선에서 먼 노트가 맞는다)

// ----- 게임 상태와 제한 시간 (6장) -----

const TIME_LIMIT = 90;     // 제한 시간 (초)
let gameState = "start";   // "start" = 시작 화면, "countdown" = 시작 전 3초 카운트다운, "playing" = 플레이 중, "paused" = 일시정지, "gameover" = 결과 화면
// 스테이지 (8장): 0 = 초급, 1 = 중급, 2 = 상급. 이기면 다음 스테이지, 지면 같은 스테이지를 다시 한다
let stage = 0;
const STAGE_NAMES = ["초급", "중급", "상급"];
// [플레이테스트용] true면 시작 화면에서 1 / 2 / 3 키로 초급 / 중급 / 상급을 바로 고를 수 있다
// 플레이테스트가 끝나면 false로 바꾸면 꺼진다 (코드를 아예 지우려면 "[플레이테스트용]"으로 검색되는 부분 3곳을 지운다)
const STAGE_SELECT_FOR_TEST = false;  // 플레이테스트가 끝나서 꺼 둠 (다시 쓰려면 true)
const COUNTDOWN_SECONDS = 3;   // 게임 시작 전 카운트다운 시간 (초). 스테이지와 상관없이 매 판 시작 때마다 나온다
let countdownStart = Date.now(); // 카운트다운을 시작한 순간의 시각 (밀리초)
// 일시정지: ESC로 "paused" 상태가 된다. 멈춘 동안 흐른 시간은 제한 시간·카운트다운에서 빼 준다
let pausedFrom = "playing";   // 일시정지 전에 어떤 상태였는지 ("countdown" 또는 "playing")
let pauseStart = 0;           // 일시정지를 시작한 순간의 시각 (밀리초)
let startTime = Date.now(); // 게임을 시작한 순간의 시각 (밀리초). 프레임 수가 아니라 실제 흐른 시간을 재는 데 쓴다

// ----- 점수 (6장) -----

const JUDGE_SCORES = { PERFECT: 700, GREAT: 500, GOOD: 200, MISS: 0 };  // 판정별 점수 (기획서 5번)
let playerScore = 0;       // 내 점수
let botScore = 0;          // 봇 점수

// 내 정확도 기록 (결과 화면에 보여 준다)
// 정확도 = 노트마다 얻은 정확도(0~100%)의 평균. 누르지 않고 놓친 노트는 0%로 친다
let accuracySum = 0;       // 맞춘 노트들의 정확도를 모두 더한 값 (0 ~ 1 단위)
let gradeCounts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };  // 판정별 개수
let passedNotes = 0;       // 누르지 않고 레인 밖으로 지나간 노트 수 (MISS로 센다)

// ----- 봇 (스테이지별 설정은 기획서 5번 스테이지 표) -----

let botPose = "bot";      // 지금 봇이 하고 있는 포즈 (그림 이름). 봇이 노트를 맞출 때마다 바뀐다

const STAGE_BOT_HIT_CHANCES = [0.81, 0.85, 0.9];   // 봇이 노트를 맞출 확률 (난이도 10% 낮춤: 0.9 / 0.94 / 1.0 → × 0.9)
const STAGE_BOT_GRADE_RATIOS = [                  // 맞춘 노트의 판정 비율 [PERFECT, GREAT, GOOD]
  [0.7, 0.3, 0.0],
  [0.78, 0.22, 0.0],
  [0.5, 0.3, 0.2],
];
let botHitChance = STAGE_BOT_HIT_CHANCES[0];     // 지금은 스테이지 1(초급)
let botGradeRatio = STAGE_BOT_GRADE_RATIOS[0];

// ----- 캐릭터, DJ, 관중, 색, 애니메이션 -----

let frameCount = 0;        // 게임이 시작된 뒤 지난 프레임 수 (반짝이 깜빡임에 쓴다)

// 캐릭터: (x, y)는 그림의 가운데 아래(발끝) 위치
const PLAYER_X = 140;
const BOT_X = 660;
const DANCER_FEET_Y = 530; // 두 댄서의 발끝 y
const DANCER_WIDTH = 134;  // 댄서 그림 가로 (원본 96의 1.4배)
const DANCER_HEIGHT = 179; // 댄서 그림 세로 (원본 128의 1.4배)

// DJ 부스: 위쪽 가운데
const DJ_X = 400;          // DJ 가운데 x
const DJ_Y = 0;            // DJ 그림 위쪽 y

// 관중: 화면 맨 아래 한 줄
const CROWD_Y = 515;       // 관중 그림 위쪽 y (아래가 화면 밖으로 잘려 상반신만 보인다)
const CROWD_GAP = 74;      // 관중 사이 간격
const CROWD_WIDTH = 90;    // 관중 그림 가로 (원본 96보다 조금 작게)
const CROWD_HEIGHT = 120;  // 관중 그림 세로 (원본 128보다 조금 작게)
const CROWD_JUMP = 10;     // 관중이 들썩일 때 올라가는 최대 높이
const CROWD_JUMP_SPEED = 0.12; // 들썩이는 빠르기 (클수록 빠르다)

// 색
const STAGE_COLOR = "#2a1b3d";   // 무대 배경 (어두운 보라)

// ----- 소리 (8장) -----
// 배경음악: Incompetech (Kevin MacLeod, CC BY 4.0) / 효과음: Mixkit (Mixkit License). 출처는 README.md에 적어 두었다
const SOUND_FILES = {
  bgm_menu: "assets/sounds/bgm_menu.mp3",       // 시작 화면
  bgm_stage1: "assets/sounds/bgm_stage1.mp3",   // 초급 (101 BPM)
  bgm_stage2: "assets/sounds/bgm_stage2.mp3",   // 중급 (115 BPM)
  bgm_stage3: "assets/sounds/bgm_stage3.mp3",   // 상급 (140 BPM)
  se_hit: "assets/sounds/se_hit.mp3",           // 노트 적중 (PERFECT · GREAT · GOOD 공통, 짧은 탭 소리). MISS는 소리 없음
  se_start: "assets/sounds/se_start.mp3",       // 시작 화면에서 키를 눌렀을 때
  se_count: "assets/sounds/se_count.mp3",       // 카운트다운 3 · 2 · 1
  se_clear: "assets/sounds/se_clear.mp3",       // 스테이지 승리 (관중 환호)
  se_lose: "assets/sounds/se_lose.mp3",         // 패배
};
const BGM_VOLUME = 0.5;    // 배경음악 음량 (0 ~ 1). 리듬게임이라 음악이 잘 들리게 효과음보다 크게
const SE_VOLUME = 0.35;    // 효과음 음량. 음악을 가리지 않게 작게
const sounds = {};         // 불러온 소리들 (이름 → Audio). ⑥ 시동에서 채운다
let currentBgm = null;     // 지금 나오는 배경음악 (없으면 null)
let muted = false;         // M 키 음소거
let lastCountNumber = 0;   // 카운트다운에서 마지막으로 삑 소리를 낸 숫자 (같은 숫자에서 두 번 안 나게)

// ----- 그림 파일 -----

// 무료 에셋: Kenney (www.kenney.nl), CC0 라이선스. 출처는 README.md에 적어 두었다.
const IMAGE_FILES = {
  player: "assets/player.png",
  player_left: "assets/player_left.png",     // ← 발차기
  player_down: "assets/player_down.png",     // ↓ 웅크리기
  player_up: "assets/player_up.png",         // ↑ 만세
  player_right: "assets/player_right.png",   // → 점프
  player_space: "assets/player_space.png",   // Space 팔 벌리기
  bot: "assets/bot.png",
  bot_left: "assets/bot_left.png",     // ← 발차기
  bot_down: "assets/bot_down.png",     // ↓ 웅크리기
  bot_up: "assets/bot_up.png",         // ↑ 만세
  bot_right: "assets/bot_right.png",   // → 점프
  bot_space: "assets/bot_space.png",   // Space 팔 벌리기
  dj: "assets/dj.png",
  crowd1: "assets/crowd1.png",
  crowd2: "assets/crowd2.png",
  crowd3: "assets/crowd3.png",
  crowd4: "assets/crowd4.png",
  note_space: "assets/note_space.png",
  sparkle: "assets/sparkle.png",
};
const LANE_NAMES = ["left", "down", "up", "right"]; // 레인 순서대로 (← ↓ ↑ →)

const images = {};         // 불러온 그림들 (이름 → 그림)
let loadedCount = 0;       // 지금까지 다 불러온 그림 수
const totalCount = Object.keys(IMAGE_FILES).length;   // 불러와야 할 그림 수

// ============================================================
// ③ 이벤트: 키보드와 싱크 조절 막대 (무슨 일이 생기면 할 일을 미리 등록)
// ============================================================

// 키를 누르는 순간 (keydown)
document.addEventListener("keydown", function (e) {
  // ESC: 카운트다운·플레이 중이면 일시정지, 일시정지 중이면 다시 계속
  if (e.key === "Escape" && !e.repeat) {
    togglePause();
    return;
  }
  // 언제든지(카운트다운·플레이 중·결과 화면) R(대문자 R도)을 누르면 처음부터 다시 시작한다
  // e.repeat: 키를 꾹 눌러서 자동 반복으로 온 keydown이면 true → 꾹 누르고 있어도 재시작은 한 번만 된다
  if ((e.key === "r" || e.key === "R") && !e.repeat) {
    resetGame();
    return;
  }
  const key = normalizeKey(e.key);        // "A"로 와도 "a"로
  // M: 음소거 켜기/끄기 (시작 화면에서 눌러도 게임이 시작되지 않게 먼저 처리한다)
  if (key === "m" && !e.repeat) {
    toggleMute();
    return;
  }
  // D: 디버그 표시 켜기/끄기 (꾹 눌러도 한 번만)
  if (key === "d" && !e.repeat) {
    showDebug = !showDebug;
    return;
  }
  // [플레이테스트용] 시작 화면에서 1 / 2 / 3: 그 스테이지를 바로 시작한다
  if (STAGE_SELECT_FOR_TEST && gameState === "start" && ["1", "2", "3"].includes(e.key) && !e.repeat) {
    stage = Number(e.key) - 1;
    playSound("se_start");
    resetGame();                   // resetGame이 고른 스테이지의 설정(applyStage)을 적용한다
    return;
  }
  // 시작 화면: 아무 키나 누르면 지금 스테이지를 시작한다 (3초 카운트다운부터)
  if (gameState === "start" && !e.repeat) {
    e.preventDefault();
    playSound("se_start");
    resetGame();
    return;
  }
  // 결과 화면에서 Enter: 이겼으면 다음 스테이지, 상급까지 이겼으면 시작 화면으로, 졌으면 같은 스테이지 다시
  if (gameState === "gameover" && e.key === "Enter" && !e.repeat) {
    nextAfterResult();
    return;
  }
  if (!GAME_KEYS.includes(key)) return;   // 게임에 안 쓰는 키는 무시
  e.preventDefault();                    // 스페이스바로 페이지가 스크롤되지 않게 막는다
  if (INPUT_MODE === "A" && gameState === "playing") {
    pressKey(key);                       // 방식 A: 이벤트 안에서 바로 판정하고 포즈를 바꾼다
  }
  keys[key] = true;                      // 방식 B: "눌렸다"고 기록만 한다. 판정은 게임 루프가 한다
});

// 브라우저는 사용자가 클릭이나 키 입력을 하기 전에는 소리를 못 내게 막는다
// 그래서 시작 화면에서는 화면을 클릭하면 메뉴 음악이 나오게 한다 (키를 누르면 바로 게임이 시작되므로)
document.addEventListener("pointerdown", function () {
  if (gameState === "start") playBgm("bgm_menu");
});

// 키에서 손을 떼는 순간 (keyup)
document.addEventListener("keyup", function (e) {
  keys[normalizeKey(e.key)] = false;     // "떼었다"고 기록한다
});

// 막대를 움직이면 값이 바뀐다. 다 움직이면 막대에서 포커스를 빼서, 게임 키가 막대로 가지 않게 한다
syncSlider.addEventListener("input", function () {
  setSync(Number(syncSlider.value));
});
syncSlider.addEventListener("change", function () {
  syncSlider.blur();
});
// − / + 버튼: 1ms씩
document.getElementById("sync-minus").addEventListener("click", function () {
  setSync(syncMs - 1);
  this.blur();   // 버튼에 포커스가 남으면 스페이스바가 버튼을 또 누르게 된다
});
document.getElementById("sync-plus").addEventListener("click", function () {
  setSync(syncMs + 1);
  this.blur();
});

// ============================================================
// ④ 함수들
// ============================================================

// ----- 키와 판정 기준 -----

// 키 이름을 소문자로 맞춘다 (Caps Lock이나 Shift 때문에 "A"로 와도 "a"로 처리). " " 같은 키는 그대로
function normalizeKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

// 판정 기준 y: 판정선 + 싱크만큼 노트가 움직이는 거리
// (1초에 약 60프레임, 한 프레임에 noteSpeed px → 1ms에 noteSpeed × 60 / 1000 px)
function judgeCenterY() {
  return JUDGE_Y + (syncMs * noteSpeed * 60) / 1000;
}

// ----- 충돌 판정: 사각형 겹치기와 판정 영역 -----

// 두 사각형이 겹치는지 검사한다. 사각형 = { x, y, width, height } (x, y는 왼쪽 위 꼭짓점)
// 가로로도 겹치고 세로로도 겹치면 → 겹친 것이다
function checkCollision(a, b) {
  return a.x < b.x + b.width &&     // A의 왼쪽이 B의 오른쪽보다 왼쪽에 있고
         a.x + a.width > b.x &&     // A의 오른쪽이 B의 왼쪽보다 오른쪽에 있고
         a.y < b.y + b.height &&    // A의 위가 B의 아래보다 위에 있고
         a.y + a.height > b.y;      // A의 아래가 B의 위보다 아래에 있으면 → 겹쳤다
}

// 판정 영역: 판정선 위아래로 JUDGE_RANGE만큼인 사각형
// lane을 주면 그 레인 한 칸, 안 주면(Space용) 레인 4개 전체 폭
function judgeBox(lane) {
  const isAll = lane === undefined;
  return {
    x: isAll ? LANE_X : LANE_X + lane * LANE_WIDTH,
    y: judgeCenterY() - JUDGE_RANGE,   // 싱크만큼 위아래로 옮겨진 판정 기준을 가운데로
    width: isAll ? LANE_WIDTH * LANE_COUNT : LANE_WIDTH,
    height: JUDGE_RANGE * 2,
  };
}

// 화살표 노트의 판정용 사각형: 노트 그림 폭 그대로, 높이는 NOTE_HITBOX_HEIGHT로 노트 가운데에
function noteHitbox(note) {
  return {
    x: LANE_X + note.lane * LANE_WIDTH + (LANE_WIDTH - NOTE_SIZE) / 2,
    y: note.y + NOTE_SIZE / 2 - NOTE_HITBOX_HEIGHT / 2,
    width: NOTE_SIZE,
    height: NOTE_HITBOX_HEIGHT,
  };
}

// Space 노트의 판정용 사각형: 막대 폭 그대로, 높이는 NOTE_HITBOX_HEIGHT로 막대 가운데에 (그림 높이 40의 절반 = 20)
function spaceHitbox() {
  return {
    x: LANE_X + 5,
    y: spaceNoteY + 20 - NOTE_HITBOX_HEIGHT / 2,
    width: LANE_WIDTH * LANE_COUNT - 10,
    height: NOTE_HITBOX_HEIGHT,
  };
}

// ----- 시간과 정확도 -----

// 남은 시간(초): 제한 시간 - 흐른 시간. Date.now()는 지금 시각(밀리초)이라 시작 시각을 빼고 1000으로 나누면 흐른 초
// Math.floor로 소수점을 버린다. 0보다 작아지지 않게 Math.max로 막는다
function remainingTime() {
  if (gameState === "start" || gameState === "countdown") return TIME_LIMIT;   // 시작 화면·카운트다운 중에는 아직 시간이 흐르지 않는다
  if (gameState === "paused" && pausedFrom === "countdown") return TIME_LIMIT;
  const now = gameState === "paused" ? pauseStart : Date.now();   // 일시정지 중에는 시간이 멈춰 있다
  const elapsed = Math.floor((now - startTime) / 1000);
  return Math.max(0, TIME_LIMIT - elapsed);
}

// 지금까지의 정확도(%) = 정확도 합 ÷ 전체 노트 수 × 100. 노트가 하나도 없으면 0
function playerAccuracy() {
  const total = gradeCounts.PERFECT + gradeCounts.GREAT + gradeCounts.GOOD + gradeCounts.MISS;
  if (total === 0) return 0;
  return (accuracySum / total) * 100;
}

// ----- 노트 줄 세우기 -----

// 노트가 1초에 내려오는 거리(px)
function notePxPerSec() {
  return noteSpeed * 60;
}

// 다음 노트까지의 시간(초): 최소~최대 간격(박자) 사이에서 반 박 단위로 무작위로 고른 뒤, 한 박자 시간(60 ÷ BPM)을 곱한다
// 예) 초급 1 ~ 2.5박 → 1, 1.5, 2, 2.5박 중 하나
function randomGapTime() {
  const choices = Math.round((maxGapBeats - minGapBeats) / GAP_STEP_BEATS) + 1;   // 고를 수 있는 간격 개수
  const gapBeats = minGapBeats + Math.floor(Math.random() * choices) * GAP_STEP_BEATS;
  return (60 / bpm) * gapBeats;
}

// 지금 음악이 몇 초째인가: 배경음악이 재생 중이면 음악의 재생 위치를 그대로 쓴다 (음악과 노트가 같은 시계를 쓴다)
// 음악이 아직 안 나오거나 파일이 없으면 Date.now()로 잰 플레이 시간을 쓴다 (일시정지 중에는 멈춘 시각 기준)
function songTime() {
  if (currentBgm && !currentBgm.broken && currentBgm.currentTime > 0) return currentBgm.currentTime;
  const now = gameState === "paused" ? pauseStart : Date.now();
  return (now - startTime) / 1000;
}

// 판정선에 닿을 시각(time)인 노트가 지금(t) 있어야 할 y. 판정선까지 남은 시간 × 속도만큼 위에 있다
function noteYAt(time, t, halfHeight) {
  return JUDGE_Y - halfHeight - (time - t) * notePxPerSec();
}

// 다음 박자 칸 하나를 받아 온다
function takeSlot() {
  const time = nextSlotTime;
  nextSlotTime = nextSlotTime + randomGapTime();
  return time;
}

// 노트 NOTE_COUNT개와 Space 노트 하나를 박자 칸에 차례로 배치해 새로 만든다 (게임 시작·재시작 때 쓴다)
// 첫 노트는 레인 맨 위 바깥에서 출발해 판정선까지 내려오는 시간이 지난 뒤의 박자에 둔다 → 처음엔 레인이 비어 있다가 위에서 내려온다
function createNotes() {
  const travelTime = (JUDGE_Y - LANE_TOP + NOTE_SIZE / 2) / notePxPerSec();   // 레인 맨 위에서 판정선까지 걸리는 시간
  const beat = 60 / bpm;
  nextSlotTime = SONG_OFFSET + Math.ceil(travelTime / beat) * beat;            // 그 시간 뒤의 첫 박
  lastSlot = null;
  const list = [];
  for (let i = 0; i < NOTE_COUNT; i++) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const time = takeSlot();
    list.push({ lane: lane, time: time, y: noteYAt(time, 0, NOTE_SIZE / 2) });
    lastSlot = { time: time, lane: lane, count: 1, space: false };
  }
  spaceNoteTime = takeSlot();                      // Space 노트는 줄 맨 뒤 칸에서 시작
  spaceNoteY = noteYAt(spaceNoteTime, 0, 20);
  lastSlot = { time: spaceNoteTime, space: true };
  return list;
}

// 노트를 줄 맨 뒤(다음 박자 칸)로 보내고, 레인(방향)을 무작위로 새로 고른다
function respawnNote(note) {
  // 동시 노트: 마지막 칸이 아직 레인 위에서 기다리는 화살표 노트 하나뿐이면,
  // CHORD_CHANCE 확률로 그 칸(같은 박자) · 다른 레인에 놓는다 → 두 키를 같이 눌러야 한다
  const waitingAbove = lastSlot && noteYAt(lastSlot.time, songTime(), NOTE_SIZE / 2) < LANE_TOP - NOTE_SIZE;
  if (waitingAbove && !lastSlot.space && lastSlot.count === 1 && Math.random() < CHORD_CHANCE) {
    note.time = lastSlot.time;
    // 1~3칸 옆 레인을 고른다 (4로 나눈 나머지를 써서 0~3 안에서 돈다) → 절대 같은 레인이 안 된다
    note.lane = (lastSlot.lane + 1 + Math.floor(Math.random() * (LANE_COUNT - 1))) % LANE_COUNT;
    lastSlot.count = 2;
    note.y = noteYAt(note.time, songTime(), NOTE_SIZE / 2);   // 위치도 바로 새 시각에 맞춘다 (안 맞추면 같은 프레임에서 옛 위치로 또 맞을 수 있다)
    return;
  }
  note.time = takeSlot();
  // Math.random()은 0 이상 1 미만의 아무 수 → 4를 곱하고 소수점을 버리면 0, 1, 2, 3 중 하나
  note.lane = Math.floor(Math.random() * LANE_COUNT);
  lastSlot = { time: note.time, lane: note.lane, count: 1, space: false };
  note.y = noteYAt(note.time, songTime(), NOTE_SIZE / 2);     // 위치도 바로 새 시각에 맞춘다
}

// Space 노트를 줄 맨 뒤(다음 박자 칸)로 보낸다
function respawnSpaceNote() {
  spaceNoteTime = takeSlot();
  lastSlot = { time: spaceNoteTime, space: true };
  spaceNoteY = noteYAt(spaceNoteTime, songTime(), 20);        // 위치도 바로 새 시각에 맞춘다
}

// ----- 싱크 값 바꾸기 -----

// 싱크 값을 정하고, 막대·글자에 반영하고, 이 브라우저에 기억해 둔다
function setSync(value) {
  syncMs = Math.max(SYNC_MIN, Math.min(SYNC_MAX, value));   // 최소~최대 사이로 자른다
  syncSlider.value = syncMs;
  syncValue.textContent = (syncMs > 0 ? "+" : "") + syncMs + "ms";
  try {
    localStorage.setItem("syncMs", syncMs);
  } catch (e) {
    // 저장소를 못 쓰는 환경이면 기억만 못 할 뿐 게임은 그대로 된다
  }
}

// ----- 판정과 점수: 봇 치기, 판정 띄우기, 키 눌렀을 때 -----

// 봇이 판정선을 지나가는 노트 하나를 친다
// botHitChance 확률로 맞추고, 맞추면 판정 비율대로 등급을 뽑아 점수를 얻고 그 방향 포즈를 취한다. 못 맞추면 MISS(0점)

function botPlay(pose) {
  if (Math.random() >= botHitChance) return;       // 놓쳤다 → 점수 없음, 포즈도 그대로
  const roll = Math.random();                      // 0 ~ 1 사이 아무 수로 등급을 뽑는다
  let grade;
  if (roll < botGradeRatio[0]) {
    grade = "PERFECT";                             // 0 ~ 0.3 → PERFECT (30%)
  } else if (roll < botGradeRatio[0] + botGradeRatio[1]) {
    grade = "GREAT";                               // 0.3 ~ 0.7 → GREAT (40%)
  } else {
    grade = "GOOD";                                // 나머지 → GOOD (30%)
  }
  botScore = botScore + JUDGE_SCORES[grade];
  botPose = pose;
}

// 노트를 맞췄을 때: 판정 기준과의 거리로 정확도를 계산해 판정 등급을 정하고, 점수·개수·이펙트를 기록한다

// 노트를 놓쳤을 때(누르지 않고 레인 아래로 지나갔을 때) MISS 글자를 띄운다. 개수는 지나간 곳에서 센다
function showMissText() {
  judgeText = "MISS";
  judgeTimer = JUDGE_SHOW_FRAMES;
  missFlashTimer = MISS_FLASH_FRAMES;             // 레인 전체 빨간 번쩍임
}

function showJudge(distance, effectX, wide) {
  // 거리 0이면 1(100%), 판정 범위 끝이면 0(0%). 소수 계산 오차(0.30000000000000004 같은)를 없애려고 소수 둘째 자리에서 반올림한다
  const accuracy = Math.round((1 - distance / JUDGE_RANGE) * 100) / 100;
  if (accuracy >= PERFECT_ACCURACY) {
    judgeText = "PERFECT";
  } else if (accuracy >= GREAT_ACCURACY) {
    judgeText = "GREAT";
  } else if (accuracy >= MISS_ACCURACY) {
    judgeText = "GOOD";
  } else {
    judgeText = "MISS";
  }
  judgeTimer = JUDGE_SHOW_FRAMES;                 // 지금부터 JUDGE_SHOW_FRAMES 동안 보여 준다
  if (judgeText === "MISS") missFlashTimer = MISS_FLASH_FRAMES;   // MISS면 레인 전체 빨간 번쩍임
  gradeCounts[judgeText] = gradeCounts[judgeText] + 1;       // 판정별 개수를 센다
  accuracySum = accuracySum + Math.max(0, accuracy);         // 정확도를 더한다 (판정 범위 끝보다 멀면 0으로)
  playerScore = playerScore + JUDGE_SCORES[judgeText];   // 판정별 점수를 내 점수에 더한다
  // 맞춘 자리에 이펙트를 하나 추가한다
  hitEffects.push({ x: effectX, y: JUDGE_Y, color: JUDGE_COLORS[judgeText], wide: wide, timer: HIT_EFFECT_FRAMES });
  // 맞춘 판정(PERFECT · GREAT · GOOD)은 같은 탭 소리, MISS는 소리 없음
  if (judgeText !== "MISS") playSound("se_hit");
}

// 게임 키 하나를 새로 눌렀을 때 할 일: 그 방향 포즈를 취하고, 판정 영역과 겹치는 노트를 맞췄는지 확인한다

function pressKey(key) {
  if (key === " ") {
    playerPose = "player_space";
    // Space 노트 판정 사각형이 판정 영역(레인 전체 폭)과 겹치면 맞춘 것
    // 단, 막대가 레인 아래(화면 밖)로 넘어가기 시작했으면 판정하지 않는다 (Space 막대 두께 12px의 절반 = 6)
    if (checkCollision(spaceHitbox(), judgeBox()) && spaceNoteY + 20 + 6 <= NOTE_END_Y) {
      const distance = Math.abs(spaceNoteY + 20 - judgeCenterY());   // 판정 등급은 판정 기준과의 거리로 정한다
      showJudge(distance, LANE_X + (LANE_WIDTH * LANE_COUNT) / 2, true);
      // 판정선을 지나기 전에 맞춰서 노트가 사라지면, 봇은 이 노트를 칠 기회가 없다 → 지금 봇도 치게 한다
      if (spaceNoteY + 20 < JUDGE_Y) botPlay("bot_space");
      respawnSpaceNote();
    }
    return;
  }
  const lane = KEY_TO_LANE[key];
  playerPose = "player_" + LANE_NAMES[lane];
  // 누른 레인의 판정 영역과 겹치는 노트 중에서 판정선에 가장 가까운 노트를 찾는다
  // (판정 영역이 레인 한 칸 폭이라, 다른 레인의 노트는 가로로 안 겹쳐서 자동으로 빠진다)
  // (판정 범위가 넓으면 같은 레인의 노트 두 개가 동시에 겹칠 수 있어서, 가까운 쪽을 맞춰야 판정이 정확하다)
  const box = judgeBox(lane);
  let closest = null;
  let closestDistance = Infinity;
  for (const note of notes) {
    if (!checkCollision(noteHitbox(note), box)) continue;   // 판정 영역과 안 겹치면 건너뛴다
    if (note.y + NOTE_SIZE / 2 + NOTE_BAR_HEIGHT / 2 > NOTE_END_Y) continue;   // 막대가 레인 아래(화면 밖)로 넘어가기 시작한 노트는 판정하지 않는다
    const distance = Math.abs(note.y + NOTE_SIZE / 2 - judgeCenterY());  // 노트 가운데가 판정 기준에서 몇 px 떨어져 있는가
    if (distance < closestDistance) {
      closest = note;
      closestDistance = distance;
    }
  }
  // 겹친 노트가 있으면 맞춘 것 → 판정을 띄우고 노트를 줄 맨 뒤로 돌려보낸다
  // 한 번 누르면 노트 하나만 맞춘다
  if (closest) {
    showJudge(closestDistance, LANE_X + lane * LANE_WIDTH + LANE_WIDTH / 2, false);
    // 봇은 노트가 판정선을 지날 때 친다. 그런데 내가 판정선보다 일찍 맞추면 노트가 바로 사라져서
    // 봇이 그 노트를 칠 기회가 없어진다 → 아직 판정선을 안 지난 노트라면 지금 봇도 치게 한다
    // (이미 판정선을 지난 노트는 봇이 벌써 쳤으므로 다시 치지 않는다. 그래서 노트마다 봇은 딱 한 번 친다)
    if (closest.y + NOTE_SIZE / 2 < JUDGE_Y) botPlay("bot_" + LANE_NAMES[lane]);
    respawnNote(closest);
  }
}

// ----- 소리 재생 -----
// 효과음 하나를 처음부터 재생한다 (빠르게 연속으로 나도 되감아서 다시 난다)
function playSound(name) {
  const sound = sounds[name];
  if (muted || !sound || sound.broken) return;   // 음소거 중이거나 파일이 없으면 조용히 넘어간다
  sound.currentTime = 0;
  sound.play().catch(function () {});            // 브라우저가 막아도 게임은 멈추지 않게 에러를 무시한다
}

// 배경음악을 바꾼다. 이미 같은 곡이 나오고 있으면 그대로 둔다
function playBgm(name) {
  const bgm = sounds[name];
  if (currentBgm === bgm && !bgm.paused) return;
  stopBgm();
  if (!bgm || bgm.broken) return;
  currentBgm = bgm;
  bgm.currentTime = 0;
  bgm.play().catch(function () {});              // 음소거 중이어도 재생은 한다 (소리만 꺼져 있다)
}

// 배경음악을 멈추고 처음으로 되감는다
function stopBgm() {
  if (currentBgm) {
    currentBgm.pause();
    currentBgm.currentTime = 0;
  }
  currentBgm = null;
}

// M 키: 음소거를 켜고 끈다
// 음악을 멈추지 않고 소리만 끈다 → 노트가 음악 재생 위치를 시계로 쓰기 때문에, 음악이 멈추면 노트도 멈춰 버린다
function toggleMute() {
  muted = !muted;
  for (const name in sounds) sounds[name].muted = muted;
}

// ----- 게임 흐름: 재시작, 일시정지 -----

// 게임을 처음 상태로 되돌린다: 점수, 시간, 노트, 포즈, 판정 표시를 전부 처음 값으로
// (재시작할 때 gameLoop()를 또 부르면 루프가 두 개가 되어 게임이 두 배로 빨라진다. 그래서 gameState만 바꾼다)
function resetGame() {
  applyStage();                  // 지금 스테이지의 노트 속도·간격과 봇 설정을 먼저 맞춘다 (노트 간격이 createNotes에 쓰인다)
  playerScore = 0;
  botScore = 0;
  notes = createNotes();         // 노트와 Space 노트를 박자 칸에 새로 배치한다
  playerPose = "player";
  botPose = "bot";
  judgeTimer = 0;
  missFlashTimer = 0;
  hitEffects = [];
  accuracySum = 0;               // 정확도 기록도 처음부터
  gradeCounts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
  passedNotes = 0;
  gameState = "countdown";       // 바로 시작하지 않고 3초 카운트다운부터
  countdownStart = Date.now();
  stopBgm();                     // 카운트다운 동안은 음악을 멈춘다
  lastCountNumber = 0;
}

// 지금 스테이지 번호(stage)에 맞게 노트 속도·간격과 봇 설정을 바꾼다
function applyStage() {
  noteSpeed = STAGE_SPEEDS[stage];
  bpm = STAGE_BPMS[stage];
  minGapBeats = STAGE_MIN_GAP_BEATS[stage];
  maxGapBeats = STAGE_MAX_GAP_BEATS[stage];
  botHitChance = STAGE_BOT_HIT_CHANCES[stage];
  botGradeRatio = STAGE_BOT_GRADE_RATIOS[stage];
}

// 시작 화면으로 간다: 스테이지 1(초급)부터 다시
function goToStart() {
  stage = 0;
  resetGame();
  gameState = "start";
  playBgm("bgm_menu");           // 시작 화면 음악 (처음 페이지를 열었을 때는 브라우저가 막아서, 화면을 클릭하면 나온다)
}

// 결과 화면에서 Enter를 눌렀을 때: 이겼으면 다음 스테이지, 상급까지 이겼으면 시작 화면으로, 졌거나 비겼으면 같은 스테이지 다시
function nextAfterResult() {
  if (playerScore > botScore) {
    if (stage < STAGE_NAMES.length - 1) {
      stage = stage + 1;
      resetGame();
    } else {
      goToStart();
    }
  } else {
    resetGame();
  }
}

// 일시정지 켜기/끄기. 결과 화면에서는 아무 일도 안 한다
function togglePause() {
  if (gameState === "countdown" || gameState === "playing") {
    pausedFrom = gameState;
    pauseStart = Date.now();
    gameState = "paused";
    if (currentBgm) currentBgm.pause();          // 음악도 멈춘다 (되감지 않고 그 자리에서)
  } else if (gameState === "paused") {
    // 멈춰 있던 시간만큼 시작 시각을 뒤로 미룬다 → 남은 시간과 카운트다운이 멈춘 자리에서 이어진다
    const pausedTime = Date.now() - pauseStart;
    startTime = startTime + pausedTime;
    countdownStart = countdownStart + pausedTime;
    gameState = pausedFrom;
    if (currentBgm) currentBgm.play().catch(function () {});   // 멈춘 자리부터 이어서
  }
}

// ----- 그리기 -----

// A S K L 과녁의 투명도: 시작 화면·카운트다운에서는 또렷하게(1), 플레이가 시작되고 KEY_GUIDE_SHOW_SECONDS가 지나면
// KEY_GUIDE_FADE_SECONDS 동안 서서히 0까지 흐려진다 (어느 키가 어느 레인인지 처음에만 알려 주는 안내)
function keyGuideAlpha() {
  if (gameState === "start" || gameState === "countdown") return 1;
  if (gameState === "paused" && pausedFrom === "countdown") return 1;
  const now = gameState === "paused" ? pauseStart : Date.now();
  const played = (now - startTime) / 1000;        // 플레이가 시작되고 흐른 초
  const alpha = 1 - (played - KEY_GUIDE_SHOW_SECONDS) / KEY_GUIDE_FADE_SECONDS;
  return Math.max(0, Math.min(1, alpha));         // 0 ~ 1 사이로 자른다
}

// 키보드 키 모양(둥근 사각형 + 글자)을 그린다. A S K L 과녁에 쓴다
// filled = true: 흰 키에 보라 글자 (노트) / false: 흰 테두리에 흰 글자 (과녁)
function drawKeyCap(x, y, size, letter, filled) {
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, size - 4, size - 4, size * 0.2);   // 모서리가 둥근 사각형
  if (filled) {
    ctx.fillStyle = "white";
    ctx.fill();
  } else {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = filled ? "#3d2d55" : "white";
  ctx.font = "bold " + Math.round(size * 0.5) + "px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, x + size / 2, y + size / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

// 무대 전체를 그린다: 배경 → DJ → 점수판 → 레인 → 판정선 → 노트 → 이펙트 → 캐릭터 → 관중 (뒤에 그린 것이 위에 덮인다)
function draw() {
  // 1. 배경: 위는 어두운 보라, 아래로 갈수록 밝은 보라가 되는 그라데이션 무대
  // createLinearGradient(시작x, 시작y, 끝x, 끝y): 위(0)에서 아래(600)로 색이 바뀐다
  const stageGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  stageGradient.addColorStop(0, STAGE_COLOR);   // 맨 위 색
  stageGradient.addColorStop(1, "#5b3a7a");     // 맨 아래 색
  ctx.fillStyle = stageGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1-1. 반짝이: 무대 위쪽 여기저기에서 천천히 깜빡이는 별 (4장 선택 과제)
  // [x, y, 크기]
  const SPARKLES = [[70, 120, 40], [230, 70, 28], [560, 80, 32], [720, 130, 44], [600, 240, 24], [190, 260, 22]];
  SPARKLES.forEach(([x, y, size], i) => {
    // Math.sin은 -1 ~ 1 사이를 부드럽게 오가는 값 → 투명도가 0.1 ~ 0.7 사이를 오간다
    // + i 를 해서 별마다 깜빡이는 타이밍을 다르게 한다
    const twinkle = Math.sin(frameCount * 0.04 + i);
    ctx.globalAlpha = 0.4 + 0.3 * twinkle;        // 투명도
    const s = size * (1 + 0.15 * twinkle);       // 밝아질 때 살짝 커진다
    ctx.drawImage(images.sparkle, x - s / 2, y - s / 2, s, s);
  });
  ctx.globalAlpha = 1;                           // 다시 100%로 되돌린다

  // 1-2. 스포트라이트: 화면 위에서 내 캐릭터에게 곧게 떨어지는 반투명 노란 빛
  // rgba의 마지막 숫자 0.15 = 15%만 보이게 (반투명)
  ctx.fillStyle = "rgba(255, 230, 150, 0.15)";
  ctx.beginPath();
  ctx.moveTo(PLAYER_X - 30, 0);                  // 위쪽 왼쪽 (좁게 시작)
  ctx.lineTo(PLAYER_X + 30, 0);                  // 위쪽 오른쪽
  ctx.lineTo(PLAYER_X + 70, DANCER_FEET_Y);      // 발끝 오른쪽 (넓게 퍼진다)
  ctx.lineTo(PLAYER_X - 70, DANCER_FEET_Y);      // 발끝 왼쪽
  ctx.closePath();                               // 시작점으로 돌아가 사다리꼴을 닫는다
  ctx.fill();

  // 2. DJ 부스: DJ 그림을 먼저 그리고, 그 위에 책상을 덮어 상반신만 보이게 한다
  ctx.drawImage(images.dj, DJ_X - 42, DJ_Y, 84, 112);  // 원본 96×128보다 조금 작게
  ctx.fillStyle = "#4a3a63";                           // 부스 책상 색
  ctx.fillRect(DJ_X - 70, DJ_Y + 84, 140, 30);
  ctx.fillStyle = "#ff8fd8";                           // 책상 앞 네온 줄
  ctx.fillRect(DJ_X - 70, DJ_Y + 84, 140, 4);
  ctx.fillStyle = "white";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";                            // 글자를 x 기준 가운데 정렬
  ctx.fillText("DJ", DJ_X, DJ_Y + 106);

  // 3. 점수판
  ctx.font = "22px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("나: " + playerScore, 20, 35);      // 왼쪽 위: 내 점수
  ctx.textAlign = "right";
  ctx.fillText("봇: " + botScore, 780, 35);        // 오른쪽 위: 봇 점수 (x=780에서 끝나게)
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("STAGE " + (stage + 1) + " " + STAGE_NAMES[stage], 400, 128);   // 가운데: 스테이지
  ctx.fillText("남은 시간: " + remainingTime(), 400, 146); // 가운데: 남은 시간

  // 4. 레인 4개: 위는 투명, 아래로 갈수록 진해지는 칸 + 테두리
  const laneGradient = ctx.createLinearGradient(0, LANE_TOP, 0, LANE_TOP + LANE_HEIGHT);
  laneGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  laneGradient.addColorStop(1, "rgba(255, 143, 216, 0.25)");
  for (let i = 0; i < LANE_COUNT; i++) {
    const x = LANE_X + i * LANE_WIDTH;              // i번째 레인의 왼쪽 x
    ctx.fillStyle = laneGradient;
    ctx.fillRect(x, LANE_TOP, LANE_WIDTH, LANE_HEIGHT);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, LANE_TOP, LANE_WIDTH, LANE_HEIGHT); // 레인 테두리
  }

  // 4-1. 판정 범위 띠: 노트 가운데가 이 띠 안에 있을 때 누르면 판정된다 (싱크를 바꾸면 띠도 같이 움직인다)
  // 안쪽일수록 좋은 판정: 가운데 노랑 = PERFECT, 하늘 = GREAT, 연두 = GOOD, 바깥 빨강 = MISS
  // 정확도 = 1 - 거리 ÷ 판정 범위 이므로, 각 판정이 시작되는 거리 = (1 - 기준 정확도) × 판정 범위
  if (SHOW_JUDGE_RANGE) {
    const center = judgeCenterY();
    const zones = [                                   // 바깥부터 안쪽 순서로 겹쳐 칠한다
      { half: JUDGE_RANGE, color: "rgba(255, 107, 107, 0.18)" },                            // MISS 구간까지 포함한 전체 범위
      { half: (1 - MISS_ACCURACY) * JUDGE_RANGE, color: "rgba(184, 242, 160, 0.22)" },      // GOOD 이상
      { half: (1 - GREAT_ACCURACY) * JUDGE_RANGE, color: "rgba(143, 211, 255, 0.30)" },     // GREAT 이상
      { half: (1 - PERFECT_ACCURACY) * JUDGE_RANGE, color: "rgba(255, 209, 102, 0.45)" },   // PERFECT
    ];
    // 레인 사각형 안쪽만 칠한다 (레인 밖은 판정되지 않으므로 띠도 보이지 않게 자른다)
    ctx.save();
    ctx.beginPath();
    ctx.rect(LANE_X, LANE_TOP, LANE_WIDTH * LANE_COUNT, LANE_HEIGHT);
    ctx.clip();
    for (const zone of zones) {
      ctx.fillStyle = zone.color;
      ctx.fillRect(LANE_X, center - zone.half, LANE_WIDTH * LANE_COUNT, zone.half * 2);
    }
    ctx.restore();
  }

  // 5. 판정선 + 과녁: 판정선 위에 테두리만 있는 키 A S K L (노트가 여기에 겹치면 누른다)
  ctx.strokeStyle = "#2f80ed";                          // 판정선 색 (파란색)
  ctx.lineWidth = 6;                                    // 판정선 두께 (3 → 6, 2배)
  ctx.beginPath();
  ctx.moveTo(LANE_X, JUDGE_Y);                          // 선 시작점
  ctx.lineTo(LANE_X + LANE_WIDTH * LANE_COUNT, JUDGE_Y); // 선 끝점
  ctx.stroke();
  for (let i = 0; i < LANE_COUNT; i++) {
    const laneLeft = LANE_X + i * LANE_WIDTH;
    // 이펙트 1: 키를 누르고 있는 레인은 판정선 위쪽이 빛난다 → 입력이 들어갔는지 바로 보인다
    if (keys[GAME_KEYS[i]]) {
      const glow = ctx.createLinearGradient(0, JUDGE_Y - 120, 0, JUDGE_Y + 30);
      glow.addColorStop(0, "rgba(255, 255, 255, 0)");
      glow.addColorStop(1, "rgba(255, 255, 255, 0.45)");
      ctx.fillStyle = glow;
      ctx.fillRect(laneLeft, JUDGE_Y - 120, LANE_WIDTH, 150);
    }
    const laneCenter = laneLeft + LANE_WIDTH / 2;      // 레인 가운데 x
    // 누르고 있는 레인의 과녁은 조금 작아져서 "눌린" 느낌을 준다
    const size = keys[GAME_KEYS[i]] ? TARGET_SIZE - 8 : TARGET_SIZE;
    ctx.globalAlpha = keyGuideAlpha();   // 플레이 시작 3초 뒤부터 서서히 투명해진다
    drawKeyCap(laneCenter - size / 2, TARGET_Y - size / 2, size, LANE_KEY_LABELS[i], false); // 테두리만 있는 키 (판정선 바로 아래, 레인 가운데에)
    ctx.globalAlpha = 1;
  }
  // 스페이스바를 누르고 있으면 판정선이 굵게 빛난다
  if (keys[" "]) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(LANE_X, JUDGE_Y - 6, LANE_WIDTH * LANE_COUNT, 12);
  }

  // 6. 노트: 레인 위에 내려오는 중인 A S K L 키 모양
  // clip: 지금부터 그리는 것은 레인 사각형 안쪽만 보이게 한다 (레인 밖으로 나간 부분은 잘려서 안 보인다)
  // 그래서 노트가 레인 위에서 스르륵 들어오고, 레인 아래로 스르륵 사라진다
  ctx.save();                                            // clip을 걸기 전 상태를 저장해 둔다
  ctx.beginPath();
  ctx.rect(LANE_X, LANE_TOP, LANE_WIDTH * LANE_COUNT, LANE_HEIGHT);
  ctx.clip();
  for (const note of notes) {
    const x = LANE_X + note.lane * LANE_WIDTH + (LANE_WIDTH - NOTE_SIZE) / 2;
    // 노트 = 가로 흰 막대: 노트 자리(NOTE_SIZE × NOTE_SIZE)의 세로 가운데에 두께 NOTE_BAR_HEIGHT로 그린다
    ctx.fillStyle = "white";
    ctx.fillRect(LANE_X + note.lane * LANE_WIDTH + 4, note.y + (NOTE_SIZE - NOTE_BAR_HEIGHT) / 2, LANE_WIDTH - 8, NOTE_BAR_HEIGHT);   // 모서리가 각진 사각형
  }

  // 7. Space 노트: 레인 4개를 가로지르는 긴 막대 + 가운데에 Space 키 그림
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(LANE_X + 5, spaceNoteY + 14, LANE_WIDTH * LANE_COUNT - 10, 12);
  ctx.drawImage(images.note_space, DJ_X - 20, spaceNoteY, 40, 40);
  // 7-0. 히트박스: showHitbox나 showDebug가 true면 노트 판정 사각형을 빨간 테두리로 그린다 (레인 안쪽만 보인다)
  if (showHitbox || showDebug) {          // 디버그 표시를 켜면 히트박스도 함께 보인다
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    for (const note of notes) {
      const box = noteHitbox(note);
      ctx.strokeRect(box.x, box.y, box.width, box.height);   // 노트 판정 사각형
    }
    const space = spaceHitbox();
    ctx.strokeRect(space.x, space.y, space.width, space.height); // Space 노트 판정 사각형
  }
  ctx.restore();                                         // clip을 풀고 원래 상태로 돌아간다
  // 판정 영역은 레인 아래로 삐져나올 수 있어서 clip을 푼 뒤에 그린다 (전체 크기가 보이게)
  if (showHitbox || showDebug) {          // 디버그 표시를 켜면 히트박스도 함께 보인다
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    for (let i = 0; i < LANE_COUNT; i++) {
      const box = judgeBox(i);
      ctx.strokeRect(box.x, box.y, box.width, box.height);   // 레인별 판정 영역
    }
  }

  // 7-0. MISS 이펙트: 레인 전체를 어두운 빨강으로 덮었다가 점점 투명하게 (MISS_FLASH_FRAMES 동안)
  if (missFlashTimer > 0) {
    ctx.fillStyle = "rgba(150, 20, 30, " + (0.2 * missFlashTimer / MISS_FLASH_FRAMES) + ")";   // 처음 20% → 0%
    ctx.fillRect(LANE_X, LANE_TOP, LANE_WIDTH * LANE_COUNT, LANE_HEIGHT);
  }

  // 7-1. 이펙트 2: 맞춘 자리에서 판정 색깔의 별과 고리가 퍼지며 사라진다
  for (const effect of hitEffects) {
    const progress = 1 - effect.timer / HIT_EFFECT_FRAMES;   // 0(막 터짐) → 1(끝)
    ctx.globalAlpha = 1 - progress;                          // 점점 투명해진다
    const radius = 20 + progress * 35;                       // 점점 커진다
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (effect.wide) {
      // Space 노트는 레인 전체 폭의 납작한 고리
      ctx.ellipse(effect.x, effect.y, (LANE_WIDTH * LANE_COUNT) / 2 + progress * 20, radius / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    }
    ctx.stroke();
    const starSize = radius * 2;
    ctx.drawImage(images.sparkle, effect.x - starSize / 2, effect.y - starSize / 2, starSize, starSize);
  }
  ctx.globalAlpha = 1;

  // 7-2. 판정 글자: 레인 위쪽에 크게 띄우고, 시간이 지날수록 흐려진다
  if (judgeTimer > 0) {
    ctx.globalAlpha = judgeTimer / JUDGE_SHOW_FRAMES;  // 남은 시간에 비례해서 투명해진다 (1 → 0)
    ctx.fillStyle = JUDGE_COLORS[judgeText];
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(judgeText, LANE_X + (LANE_WIDTH * LANE_COUNT) / 2, LANE_TOP + 90);   // 레인 맨 위에서 90px 아래
    ctx.globalAlpha = 1;
  }

  // 8. 댄서: 나(왼쪽)와 봇(오른쪽). 그림의 가운데 아래가 발끝 위치에 오게 그린다
  const dancerTop = DANCER_FEET_Y - DANCER_HEIGHT;
  ctx.drawImage(images[playerPose], PLAYER_X - DANCER_WIDTH / 2, dancerTop, DANCER_WIDTH, DANCER_HEIGHT);
  ctx.drawImage(images[botPose], BOT_X - DANCER_WIDTH / 2, dancerTop, DANCER_WIDTH, DANCER_HEIGHT);
  ctx.fillStyle = "white";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("나", PLAYER_X, dancerTop + 30);    // 머리 위 이름표 (그림 위쪽에 빈 공간이 있어 조금 내린다)
  ctx.fillText(STAGE_NAMES[stage] + " 봇", BOT_X, dancerTop + 30);

  // 9. 관중: 무대를 바라보는 뒷모습 4종을 번갈아 한 줄로 세운다
  const crowd = [images.crowd1, images.crowd2, images.crowd3, images.crowd4];
  for (let i = 0; i * CROWD_GAP < canvas.width + CROWD_GAP; i++) {
    // Math.abs(Math.sin(...))는 0 ~ 1 사이를 오가는 값 → 관중이 위로 통통 튄다
    // + i * 0.7 을 해서 사람마다 튀는 타이밍을 다르게 한다 (파도타기처럼 보인다)
    const jump = Math.abs(Math.sin(frameCount * CROWD_JUMP_SPEED + i * 0.7)) * CROWD_JUMP;
    ctx.drawImage(crowd[i % 4], i * CROWD_GAP - 36, CROWD_Y - jump, CROWD_WIDTH, CROWD_HEIGHT);
  }
}

// 카운트다운 화면: 화면 정중앙에 남은 초(3 → 2 → 1)를 크게 띄운다
function drawCountdown() {
  const elapsed = (Date.now() - countdownStart) / 1000;          // 카운트다운 시작 후 흐른 초 (소수 포함)
  const number = COUNTDOWN_SECONDS - Math.floor(elapsed);         // 3, 2, 1
  const progress = elapsed - Math.floor(elapsed);                 // 이번 숫자가 뜬 뒤 흐른 정도 (0 → 1)
  ctx.globalAlpha = 1 - progress * 0.6;                           // 숫자가 바뀔 때마다 진하게 떴다가 점점 흐려진다
  ctx.fillStyle = "white";
  ctx.font = "bold " + Math.round(140 - progress * 30) + "px sans-serif";  // 크게 떴다가 조금씩 작아진다
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";                                     // 글자 세로 가운데를 y에 맞춘다
  ctx.fillText(number, canvas.width / 2, canvas.height / 2);       // 화면 정중앙 (400, 300)
  ctx.textBaseline = "alphabetic";                                 // 다른 글자들을 위해 원래대로 되돌린다
  ctx.globalAlpha = 1;
}

// 화면 전체를 반투명 검은 막으로 덮는다 (일시정지·결과·시작 화면이 같이 쓴다). darkness = 0 ~ 1, 클수록 어둡다
function drawDimOverlay(darkness) {
  ctx.fillStyle = "rgba(0, 0, 0, " + darkness + ")";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// 일시정지 화면: 어두운 막 + 안내
function drawPause() {
  drawDimOverlay(0.6);
  ctx.textAlign = "center";
  ctx.fillStyle = "white";
  ctx.font = "bold 60px sans-serif";
  ctx.fillText("일시정지", 400, 250);
  ctx.font = "22px sans-serif";
  ctx.fillText("ESC: 계속하기     R: 처음부터 다시 시작", 400, 320);
  ctx.fillStyle = "#ffd166";
  ctx.font = "20px sans-serif";
  ctx.fillText("싱크: " + (syncMs > 0 ? "+" : "") + syncMs + "ms  (화면 아래 막대로 조절)", 400, 370);
}

// 결과 화면: 무대 위에 어두운 막을 덮고, 가운데에 승패와 점수를 띄운다
function drawResult() {
  drawDimOverlay(0.6);                            // 반투명 검은 막
  ctx.textAlign = "center";
  let resultText = "패배…";
  let resultColor = "#8fd3ff";
  const won = playerScore > botScore;
  const lastStage = stage === STAGE_NAMES.length - 1;
  if (won) {
    resultText = lastStage ? "최종 우승!" : "승리!";      // 상급까지 이기면 최종 우승
    resultColor = "#ffd166";
  } else if (playerScore === botScore) {
    resultText = "무승부";                        // 점수가 같을 때
    resultColor = "#ffffff";
  }
  ctx.fillStyle = resultColor;
  ctx.font = "bold 72px sans-serif";
  ctx.fillText(resultText, 400, 200);
  ctx.fillStyle = "white";
  ctx.font = "28px sans-serif";
  ctx.fillText("내 점수: " + playerScore, 400, 265);
  ctx.fillText("봇 점수: " + botScore, 400, 305);
  // 내 정확도: 소수 첫째 자리까지 (toFixed(1) = 소수점 아래 한 자리로 반올림한 글자)
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("정확도: " + playerAccuracy().toFixed(1) + "%", 400, 365);
  // 판정별 개수: 판정 색으로 한 줄에
  ctx.font = "20px sans-serif";
  const grades = ["PERFECT", "GREAT", "GOOD", "MISS"];
  for (let i = 0; i < grades.length; i++) {
    ctx.fillStyle = JUDGE_COLORS[grades[i]];
    ctx.fillText(grades[i] + " " + gradeCounts[grades[i]], 190 + i * 140, 410);
  }
  ctx.fillStyle = "white";
  ctx.font = "18px sans-serif";
  // 다음에 할 수 있는 것 안내
  let nextText = "Enter: 다시 도전     R: 다시 시작";
  if (won && !lastStage) nextText = "Enter: 다음 스테이지 (" + STAGE_NAMES[stage + 1] + ")     R: 이 스테이지 다시";
  if (won && lastStage) nextText = "Enter: 처음 화면으로     R: 상급 다시";
  ctx.fillText(nextText, 400, 465);
}

// 시작 화면: 무대 위에 어두운 막을 덮고, 제목·목표·조작법·시작 안내를 띄운다 (8장)
function drawStart() {
  drawDimOverlay(0.65);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 52px sans-serif";
  ctx.fillText("오늘 밤 주인공은 나야나", 400, 210);
  ctx.fillStyle = "white";
  ctx.font = "22px sans-serif";
  ctx.fillText("90초 동안 봇보다 높은 점수를 얻으면 승리! 초급 → 중급 → 상급", 400, 275);
  ctx.font = "18px sans-serif";
  ctx.fillText("A S K L + Space: 노트 치기     ESC: 일시정지     R: 다시 시작", 400, 320);
  ctx.fillText("판정이 늦거나 빠르면 화면 아래 싱크 막대로 맞춰 주세요", 400, 350);
  // 9장 모바일 대응: 터치 조작이 없어서 휴대폰에서는 플레이할 수 없다고 미리 알린다
  ctx.fillStyle = "#bbbbbb";
  ctx.font = "16px sans-serif";
  ctx.fillText("PC에서 키보드로 플레이해 주세요 (휴대폰 터치는 지원하지 않아요)", 400, 385);
  // "아무 키나 눌러 시작"은 깜빡인다: Math.sin으로 투명도가 0.3 ~ 1 사이를 오간다
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(frameCount * 0.08);
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("아무 키나 눌러 시작", 400, 430);
  ctx.globalAlpha = 1;
  // [플레이테스트용] 스테이지 바로 고르기 안내
  if (STAGE_SELECT_FOR_TEST) {
    ctx.fillStyle = "#8fd3ff";
    ctx.font = "16px sans-serif";
    ctx.fillText("[테스트용] 1: 초급   2: 중급   3: 상급 바로 시작", 400, 470);
  }
  ctx.globalAlpha = 1;
}

// 디버그 표시: 왼쪽 위(내 점수 아래)에 지금 게임 상태 숫자들을 작은 글씨로 띄운다 (7장)
function drawDebug() {
  // 화면(레인 안)에 보이는 노트 개수: 레인 위쪽 끝과 아래쪽 끝 사이에 걸쳐 있는 노트만 센다
  let visibleNotes = 0;
  for (const note of notes) {
    if (note.y + NOTE_SIZE > LANE_TOP && note.y < NOTE_END_Y) visibleNotes = visibleNotes + 1;
  }
  if (spaceNoteY + 40 > LANE_TOP && spaceNoteY < NOTE_END_Y) visibleNotes = visibleNotes + 1;   // Space 노트도 센다

  const lines = [
    "gameState: " + gameState,
    "남은 시간: " + remainingTime() + "초",
    "화면 노트: " + visibleNotes + "개",
    "나: " + playerScore + " / 봇: " + botScore,
    "싱크: " + (syncMs > 0 ? "+" : "") + syncMs + "ms",
    "BPM: " + bpm + " / 간격 " + minGapBeats + "~" + maxGapBeats + "박",
    "음악 시각: " + songTime().toFixed(2) + "초",
    "정확도: " + playerAccuracy().toFixed(1) + "%",
  ];
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";                 // 글자가 잘 보이게 반투명 검은 상자
  ctx.fillRect(10, 48, 180, lines.length * 17 + 10);
  ctx.fillStyle = "#b8f2a0";
  ctx.font = "13px monospace";
  ctx.textAlign = "left";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 18, 66 + i * 17);
  }
}

// ============================================================
// ⑤ 게임 루프: 지우기 → 계산 → 그리기를 1초에 약 60번 반복한다
// ============================================================

function gameLoop() {
  // ① 지우기: 이전 프레임에 그린 것을 모두 지운다
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ② 계산: 프레임 수를 세고, 키 입력을 판정하고, 노트를 속도만큼 아래로 내린다
  // (반짝이·관중 애니메이션과 판정 글자·이펙트는 결과 화면에서도 계속 움직인다)
  frameCount = frameCount + 1;
  if (judgeTimer > 0) judgeTimer = judgeTimer - 1;   // 판정 글자가 사라질 때까지 남은 시간을 줄인다
  if (missFlashTimer > 0) missFlashTimer = missFlashTimer - 1;   // 빨간 번쩍임도 점점 사라진다
  for (const effect of hitEffects) effect.timer = effect.timer - 1;   // 이펙트 남은 시간을 줄이고
  hitEffects = hitEffects.filter((effect) => effect.timer > 0);      // 다 끝난 이펙트는 목록에서 뺀다

  // 카운트다운이 끝나면 플레이 시작: 이때부터 제한 시간을 잰다
  // 카운트다운 숫자가 바뀔 때마다 삑 소리 (3 → 2 → 1)
  if (gameState === "countdown") {
    const countNumber = COUNTDOWN_SECONDS - Math.floor((Date.now() - countdownStart) / 1000);
    if (countNumber >= 1 && countNumber !== lastCountNumber) {
      playSound("se_count");
      lastCountNumber = countNumber;
    }
  }
  if (gameState === "countdown" && Date.now() - countdownStart >= COUNTDOWN_SECONDS * 1000) {
    gameState = "playing";
    startTime = Date.now();
    playBgm("bgm_stage" + (stage + 1));             // 스테이지 음악 시작
  }

  // 플레이 중일 때만: 시간 확인, 키 판정, 노트 이동 (카운트다운·결과 화면에서는 노트가 멈춘다)
  if (gameState === "playing") {
    if (remainingTime() === 0) {
      gameState = "gameover";                         // 제한 시간이 끝났다 → 결과 화면으로
      stopBgm();
      playSound(playerScore > botScore ? "se_clear" : "se_lose");   // 이기면 관중 환호, 지면 패배음
    }

    // 방식 B: keys 메모장을 보고 판정한다
    if (INPUT_MODE === "B") {
      let anyKeyHeld = false;
      for (const key of GAME_KEYS) {
        // 지금은 눌려 있는데 지난 프레임에는 안 눌려 있었다 = 방금 새로 누른 키 → 한 번만 판정 (꾹 눌러도 연속 판정 안 됨)
        if (keys[key] && !prevKeys[key]) {
          pressKey(key);
        }
        if (keys[key]) anyKeyHeld = true;
        prevKeys[key] = keys[key];
      }
      if (!anyKeyHeld) playerPose = "player";       // 모든 키에서 손을 떼면 기본 포즈로 돌아온다
    }

    // 먼저 모든 노트를 지금 음악 시각에 맞는 위치로 옮긴 다음, 빠져나간 노트를 처리한다
    // (옮기면서 바로 처리하면 아직 안 옮긴 노트와 시각이 어긋난다)
    const t = songTime();
    for (const note of notes) {
      const before = note.y + NOTE_SIZE / 2;         // 옮기기 전 노트 가운데
      note.y = noteYAt(note.time, t, NOTE_SIZE / 2); // 판정선까지 남은 시간만큼 위에 있다
      // 노트 가운데가 이번 프레임에 판정선을 지나갔으면, 봇이 그 노트를 친다
      if (before < JUDGE_Y && note.y + NOTE_SIZE / 2 >= JUDGE_Y) {
        botPlay("bot_" + LANE_NAMES[note.lane]);
      }
    }
    const spaceBefore = spaceNoteY + 20;
    spaceNoteY = noteYAt(spaceNoteTime, t, 20);
    if (spaceBefore < JUDGE_Y && spaceNoteY + 20 >= JUDGE_Y) {
      botPlay("bot_space");                          // Space 노트가 판정선을 지나가면 봇이 친다 (맞추면 팔 벌리기 포즈)
    }
    for (const note of notes) {
      // 레인 맨 아래로 빠져나가면 줄 맨 뒤로 돌아간다
      if (note.y > NOTE_END_Y) {                   // 노트 윗부분까지 레인 밖으로 다 나가면
        gradeCounts.MISS = gradeCounts.MISS + 1;   // 못 누르고 지나간 노트 → MISS로 센다 (정확도 0%)
        passedNotes = passedNotes + 1;
        showMissText();                            // 화면(레인) 밖으로 내려간 노트 = 놓친 것 → MISS 표시
        respawnNote(note);
      }
    }
    if (spaceNoteY > NOTE_END_Y) {               // Space 노트도 레인 밖으로 다 나가면
      gradeCounts.MISS = gradeCounts.MISS + 1;
      passedNotes = passedNotes + 1;
      showMissText();
      respawnSpaceNote();
    }
  } // if (gameState === "playing") 끝

  // ③ 그리기: 바뀐 위치대로 무대 전체를 다시 그린다. 결과 화면이면 그 위에 결과를 덮는다
  draw();
  if (gameState === "start") {
    drawStart();
  } else if (gameState === "countdown") {
    drawCountdown();
  } else if (gameState === "paused") {
    drawPause();
  } else if (gameState === "gameover") {
    drawResult();
  }
  if (showDebug) {
    drawDebug();                       // 디버그 정보는 카운트다운·일시정지·결과 화면 위에도 보이게 맨 마지막에 그린다
  }
  // 음소거 상태: 화면 오른쪽 아래 구석에 작게
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(canvas.width - 128, canvas.height - 30, 120, 22);
  ctx.fillStyle = muted ? "#ff6b6b" : "white";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(muted ? "음소거 켜짐 (M)" : "소리 켜짐 (M)", canvas.width - 14, canvas.height - 14);

  // ④ 다음 프레임에 gameLoop를 또 불러 달라고 브라우저에 부탁한다
  requestAnimationFrame(gameLoop);
}

// ============================================================
// ⑥ 시동: 싱크 막대를 준비하고, 그림을 다 불러오면 게임 루프를 시작한다
// ============================================================

syncSlider.min = SYNC_MIN;
syncSlider.max = SYNC_MAX;
setSync(syncMs);

// 소리 불러오기: 파일이 없거나 못 불러오면 broken 표시만 하고 게임은 그대로 돌아간다
for (const name in SOUND_FILES) {
  const audio = new Audio(SOUND_FILES[name]);
  audio.preload = "auto";
  audio.volume = name.startsWith("bgm") ? BGM_VOLUME : SE_VOLUME;
  audio.loop = name.startsWith("bgm");             // 배경음악은 반복
  audio.addEventListener("error", function () {
    audio.broken = true;
  });
  sounds[name] = audio;
}

// 그림을 하나씩 불러오고, 전부 다 불러오면 시작 화면을 준비한 뒤 gameLoop()를 시작한다
// (다 불러오기 전에 그리면 아무것도 안 나온다)
for (const name in IMAGE_FILES) {
  images[name] = new Image();
  images[name].onload = function () {
    loadedCount++;
    if (loadedCount === totalCount) {
      goToStart();                       // 그림을 다 불러오면 시작 화면부터 (스테이지 1)
      gameLoop();                        // 그림을 다 불러온 뒤에 게임 루프를 시작한다 (루프는 여기서 딱 한 번만 시작한다)
    }
  };
  images[name].src = IMAGE_FILES[name];
}
