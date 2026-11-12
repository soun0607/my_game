const canvas = document.getElementById("game");  // 이름이 "game"인 도화지를 찾는다
const ctx = canvas.getContext("2d");             // 그 도화지에 그릴 "붓"을 가져온다

// ===== 위치와 크기 모음 (여기 숫자만 바꾸면 화면이 바뀐다) =====

// 레인: 가운데 세로 줄 4개
const LANE_X = 280;        // 첫 번째 레인의 왼쪽 x
const LANE_TOP = 150;      // 레인이 시작하는 y
const LANE_WIDTH = 60;     // 레인 한 칸의 너비
const LANE_HEIGHT = 380;   // 레인의 높이 (150 + 380 = 530까지)
const LANE_COUNT = 4;      // 레인 개수 (← ↓ ↑ →)

// 판정선: 노트가 여기 닿을 때 키를 누른다
const JUDGE_Y = 500;

// 노트: lane = 몇 번째 레인(0~3), y = 지금 세로 위치
// y는 매 프레임 바뀌는 "상태"라서 let으로 만든다
// 스테이지별 노트 간격 (노트 사이의 세로 거리, px): 초급 120 / 중급 90 / 상급 70
// 간격이 넓을수록 노트가 드문드문 나온다
const STAGE_GAPS = [120, 90, 70];
let noteGap = STAGE_GAPS[0];   // 지금은 스테이지 1(초급)
const NOTE_COUNT = 11;     // 화살표 노트 개수. 레인을 다 채우고도 위에서 기다리는 노트가 남을 만큼 넉넉하게
                           // (모자라면 줄 맨 뒤가 비어서 동시 노트가 만들어지지 않는다. 기준: 노트가 지나가는 거리 430 ÷ 가장 좁은 간격(70) + 4)

// 노트 NOTE_COUNT개를 레인 바로 위(안 보이는 곳)부터 위쪽으로 noteGap 간격으로 줄 세워 만든다 (게임 시작·재시작 때 쓴다)
// 처음에는 레인이 비어 있다가, 카운트다운이 끝나면 첫 노트부터 레인 위에서 내려온다
// 줄 맨 뒤 위치는 Space 노트 자리로 쓰려고 lineY에 남겨 둔다
const FIRST_NOTE_Y = 150 - 50;   // 첫 노트 위치 = 레인 맨 위(150) - 노트 크기(50). 레인 바로 위라 아직 안 보인다
let lineY = FIRST_NOTE_Y;
function createNotes() {
  const list = [];
  lineY = FIRST_NOTE_Y;
  for (let i = 0; i < NOTE_COUNT; i++) {
    list.push({ lane: Math.floor(Math.random() * 4), y: lineY });
    lineY = lineY - noteGap;
  }
  return list;
}
let notes = createNotes();
// ===== 입력과 판정 (5장) =====
const INPUT_MODE = "B";    // 조작 방식. "A" = 키 이벤트 안에서 바로 판정 (비교 실험용), "B" = keys에 기록하고 게임 루프에서 판정
const JUDGE_RANGE = 50;    // 노트 가운데가 판정선에서 이 거리(px) 안에 있을 때 키를 누르면 맞춘 것
// 조작키: 플레이테스트 피드백으로 방향키 대신 A S K L (왼손 두 손가락 + 오른손 두 손가락)
const KEY_TO_LANE = { a: 0, s: 1, k: 2, l: 3 };  // 키 → 레인 번호 (레인 순서: ← ↓ ↑ →)
const GAME_KEYS = ["a", "s", "k", "l", " "];   // 게임에 쓰는 키 (" "는 스페이스바)
const LANE_KEY_LABELS = ["A", "S", "K", "L"];  // 레인 아래에 보여 줄 키 이름

// 키 이름을 소문자로 맞춘다 (Caps Lock이나 Shift 때문에 "A"로 와도 "a"로 처리). " " 같은 키는 그대로
function normalizeKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

// ===== 싱크 조절 (플레이테스트 피드백) =====
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

// 판정 기준 y: 판정선 + 싱크만큼 노트가 움직이는 거리
// (1초에 약 60프레임, 한 프레임에 noteSpeed px → 1ms에 noteSpeed × 60 / 1000 px)
function judgeCenterY() {
  return JUDGE_Y + (syncMs * noteSpeed * 60) / 1000;
}
const keys = {};           // 지금 눌려 있는 키를 적어 두는 메모장 (true = 눌림, false = 안 눌림)
const prevKeys = {};       // 지난 프레임에 눌려 있던 키 (이번 프레임에 "새로" 눌렸는지 알아내는 데 쓴다)
let playerPose = "player"; // 지금 내 캐릭터가 하고 있는 포즈 (그림 이름)

// 판정 등급: 정확도 = 판정선에 얼마나 가깝게 눌렀는가 (판정선 한가운데 100%, 판정 범위 끝 0%)
const PERFECT_ACCURACY = 0.90;  // 90% 이상 → PERFECT
const GREAT_ACCURACY = 0.70;    // 70% 이상 ~ 90% 미만 → GREAT
const MISS_ACCURACY = 0.20;     // 20% 이상 ~ 70% 미만 → GOOD, 20% 미만 → MISS (너무 일찍/늦게 눌렀다)
const JUDGE_SHOW_FRAMES = 40;   // 판정 글자를 화면에 띄워 두는 시간 (프레임 수, 60 = 약 1초)
let judgeText = "";        // 지금 띄울 판정 글자 ("PERFECT" / "GREAT" / "GOOD" / "MISS")
let judgeTimer = 0;        // 판정 글자가 사라지기까지 남은 프레임 수
const JUDGE_COLORS = { PERFECT: "#ffd166", GREAT: "#8fd3ff", GOOD: "#b8f2a0", MISS: "#ff6b6b" }; // 판정별 색 (글자와 이펙트에 같이 쓴다)

// 입력 이펙트
const HIT_EFFECT_FRAMES = 20;  // 맞췄을 때 터지는 이펙트가 보이는 시간 (프레임 수)
let hitEffects = [];       // 지금 화면에 보이는 이펙트 목록. 하나 = { x, y, color, wide, timer }

// ===== 충돌 판정 (6장) =====
let showHitbox = false;     // true면 판정 영역과 노트 판정 영역을 빨간 테두리로 그린다 (확인이 끝나면 false로 끈다)
let showDebug = true;      // true면 왼쪽 위에 디버그 정보를 띄우고, 히트박스도 함께 그린다. D 키로 켜고 끈다 (제출할 때는 false)
const NOTE_HITBOX_HEIGHT = 10;  // 노트 판정용 사각형의 세로 크기. 그림(50)보다 얇게, 노트 가운데에 둔다
                                // (그림 전체로 판정하면 노트 끝만 걸쳐도 맞은 것이 되어서, 판정선에서 먼 노트가 맞는다)

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

// ===== 게임 상태와 제한 시간 (6장) =====
const TIME_LIMIT = 90;     // 제한 시간 (초)
let gameState = "countdown"; // "countdown" = 시작 전 3초 카운트다운, "playing" = 플레이 중, "gameover" = 시간이 끝나서 결과 화면
const COUNTDOWN_SECONDS = 3;   // 게임 시작 전 카운트다운 시간 (초). 스테이지와 상관없이 매 판 시작 때마다 나온다
let countdownStart = Date.now(); // 카운트다운을 시작한 순간의 시각 (밀리초)
// 일시정지: ESC로 "paused" 상태가 된다. 멈춘 동안 흐른 시간은 제한 시간·카운트다운에서 빼 준다
let pausedFrom = "playing";   // 일시정지 전에 어떤 상태였는지 ("countdown" 또는 "playing")
let pauseStart = 0;           // 일시정지를 시작한 순간의 시각 (밀리초)
let startTime = Date.now(); // 게임을 시작한 순간의 시각 (밀리초). 프레임 수가 아니라 실제 흐른 시간을 재는 데 쓴다

// 남은 시간(초): 제한 시간 - 흐른 시간. Date.now()는 지금 시각(밀리초)이라 시작 시각을 빼고 1000으로 나누면 흐른 초
// Math.floor로 소수점을 버린다. 0보다 작아지지 않게 Math.max로 막는다
function remainingTime() {
  if (gameState === "countdown") return TIME_LIMIT;   // 카운트다운 중에는 아직 시간이 흐르지 않는다
  if (gameState === "paused" && pausedFrom === "countdown") return TIME_LIMIT;
  const now = gameState === "paused" ? pauseStart : Date.now();   // 일시정지 중에는 시간이 멈춰 있다
  const elapsed = Math.floor((now - startTime) / 1000);
  return Math.max(0, TIME_LIMIT - elapsed);
}

let botPose = "bot";      // 지금 봇이 하고 있는 포즈 (그림 이름). 봇이 노트를 맞출 때마다 바뀐다

// ===== 점수 (6장) =====
const JUDGE_SCORES = { PERFECT: 700, GREAT: 500, GOOD: 200, MISS: 0 };  // 판정별 점수 (기획서 5번)
let playerScore = 0;       // 내 점수
let botScore = 0;          // 봇 점수

// 내 정확도 기록 (결과 화면에 보여 준다)
// 정확도 = 노트마다 얻은 정확도(0~100%)의 평균. 누르지 않고 놓친 노트는 0%로 친다
let accuracySum = 0;       // 맞춘 노트들의 정확도를 모두 더한 값 (0 ~ 1 단위)
let gradeCounts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };  // 판정별 개수
let passedNotes = 0;       // 누르지 않고 레인 밖으로 지나간 노트 수 (MISS로 센다)

// 지금까지의 정확도(%) = 정확도 합 ÷ 전체 노트 수 × 100. 노트가 하나도 없으면 0
function playerAccuracy() {
  const total = gradeCounts.PERFECT + gradeCounts.GREAT + gradeCounts.GOOD + gradeCounts.MISS;
  if (total === 0) return 0;
  return (accuracySum / total) * 100;
}

// 스테이지별 봇 설정 (기획서 5번 스테이지 표): 초급 / 중급 / 상급
const STAGE_BOT_HIT_CHANCES = [0.9, 0.9, 1.0];   // 봇이 노트를 맞출 확률
const STAGE_BOT_GRADE_RATIOS = [                  // 맞춘 노트의 판정 비율 [PERFECT, GREAT, GOOD]
  [0.5, 0.3, 0.2],
  [0.6, 0.3, 0.1],
  [0.7, 0.2, 0.1],
];
let botHitChance = STAGE_BOT_HIT_CHANCES[0];     // 지금은 스테이지 1(초급)
let botGradeRatio = STAGE_BOT_GRADE_RATIOS[0];
let frameCount = 0;        // 게임이 시작된 뒤 지난 프레임 수 (반짝이 깜빡임에 쓴다)
let spaceNoteY = lineY;    // Space 노트(레인 4개를 가로지르는 긴 막대)의 y. 줄 맨 뒤에서 시작한다
const CHORD_CHANCE = 0.2;  // 동시 노트(두 키를 같이 눌러야 하는 노트)가 나올 확률 (0.2 = 20%)
// 스테이지별 노트 속도 (속도 튜닝으로 정함): 초급 2 / 중급 4 / 상급 6
const STAGE_SPEEDS = [3, 4, 5];
let noteSpeed = STAGE_SPEEDS[0];   // 지금은 스테이지 1(초급). 노트가 한 프레임에 아래로 내려오는 거리
const NOTE_SIZE = 50;      // 노트 그림 크기 (가로 = 세로)
const TARGET_SIZE = Math.round(NOTE_SIZE * 1.1);  // 판정선 위 과녁(판정 박스) 그림 크기: 노트의 1.1배 = 55
const NOTE_START_Y = LANE_TOP;                // 노트가 다시 나타나는 y (레인 맨 위)
const NOTE_END_Y = LANE_TOP + LANE_HEIGHT;    // 노트가 사라지는 y (레인 맨 아래). 노트 윗부분까지 이 선을 넘으면 줄 맨 뒤로 돌아간다

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

// ===== 그림 파일 불러오기 =====
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

// 그림을 하나씩 불러오고, 전부 다 불러오면 draw()로 화면을 그린다
// (다 불러오기 전에 그리면 아무것도 안 나온다)
const images = {};
let loadedCount = 0;
const totalCount = Object.keys(IMAGE_FILES).length;
for (const name in IMAGE_FILES) {
  images[name] = new Image();
  images[name].onload = function () {
    loadedCount++;
    if (loadedCount === totalCount) {
      resetGame();                       // 그림을 다 불러온 순간부터 시간을 잰다
      gameLoop();                        // 그림을 다 불러온 뒤에 게임 루프를 시작한다 (루프는 여기서 딱 한 번만 시작한다)
    }
  };
  images[name].src = IMAGE_FILES[name];
}

// ===== 그리기 =====

// 키보드 키 모양(둥근 사각형 + 글자)을 그린다. 노트와 과녁에 쓴다
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
  ctx.fillText("STAGE 1 초급", 400, 128);          // 가운데: 스테이지
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

  // 5. 판정선 + 과녁: 판정선 위에 테두리만 있는 화살표 키 (노트가 여기에 겹치면 누른다)
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
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
    drawKeyCap(laneCenter - size / 2, JUDGE_Y - size / 2, size, LANE_KEY_LABELS[i], false); // 테두리만 있는 키 (가운데가 레인 가운데 · 판정선에 오게)
  }
  // 스페이스바를 누르고 있으면 판정선이 굵게 빛난다
  if (keys[" "]) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(LANE_X, JUDGE_Y - 6, LANE_WIDTH * LANE_COUNT, 12);
  }

  // 6. 노트: 레인 위에 내려오는 중인 화살표 키 그림
  // clip: 지금부터 그리는 것은 레인 사각형 안쪽만 보이게 한다 (레인 밖으로 나간 부분은 잘려서 안 보인다)
  // 그래서 노트가 레인 위에서 스르륵 들어오고, 레인 아래로 스르륵 사라진다
  ctx.save();                                            // clip을 걸기 전 상태를 저장해 둔다
  ctx.beginPath();
  ctx.rect(LANE_X, LANE_TOP, LANE_WIDTH * LANE_COUNT, LANE_HEIGHT);
  ctx.clip();
  for (const note of notes) {
    const x = LANE_X + note.lane * LANE_WIDTH + (LANE_WIDTH - NOTE_SIZE) / 2;
    drawKeyCap(x, note.y, NOTE_SIZE, LANE_KEY_LABELS[note.lane], true);   // 흰 키 위에 그 레인의 키 이름
  }

  // 7. Space 노트: 레인 4개를 가로지르는 긴 막대 + 가운데에 Space 키 그림
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(LANE_X + 5, spaceNoteY + 14, LANE_WIDTH * LANE_COUNT - 10, 12);
  ctx.drawImage(images.note_space, DJ_X - 20, spaceNoteY, 40, 40);
  // 7-0. 히트박스: showHitbox가 true면 노트 판정 사각형을 빨간 테두리로 그린다 (레인 안쪽만 보인다)
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

  // 7-0. 이펙트 2: 맞춘 자리에서 판정 색깔의 별과 고리가 퍼지며 사라진다
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

  // 7-1. 판정 글자: 레인 위쪽에 크게 띄우고, 시간이 지날수록 흐려진다
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
  ctx.fillText("초급 봇", BOT_X, dancerTop + 30);

  // 9. 관중: 무대를 바라보는 뒷모습 4종을 번갈아 한 줄로 세운다
  const crowd = [images.crowd1, images.crowd2, images.crowd3, images.crowd4];
  for (let i = 0; i * CROWD_GAP < canvas.width + CROWD_GAP; i++) {
    // Math.abs(Math.sin(...))는 0 ~ 1 사이를 오가는 값 → 관중이 위로 통통 튄다
    // + i * 0.7 을 해서 사람마다 튀는 타이밍을 다르게 한다 (파도타기처럼 보인다)
    const jump = Math.abs(Math.sin(frameCount * CROWD_JUMP_SPEED + i * 0.7)) * CROWD_JUMP;
    ctx.drawImage(crowd[i % 4], i * CROWD_GAP - 36, CROWD_Y - jump, CROWD_WIDTH, CROWD_HEIGHT);
  }
}

// ===== 싱크 조절 막대 (index.html의 화면 아래) =====
const syncSlider = document.getElementById("sync");
const syncValue = document.getElementById("sync-value");
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
syncSlider.min = SYNC_MIN;
syncSlider.max = SYNC_MAX;
setSync(syncMs);
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

// ===== 키 입력 =====

// 다시 나타날 노트의 y: 지금 가장 위에 있는 노트보다 noteGap만큼 더 위 (레인 맨 위보다 아래로는 안 간다)
// 이렇게 하면 노트가 줄을 서서 내려오므로 서로 겹치지 않는다
function nextSpawnY(except) {
  let topY = Infinity;
  for (const note of notes) {
    if (note !== except && note.y < topY) topY = note.y;
  }
  if (except !== "space" && spaceNoteY < topY) topY = spaceNoteY;
  return Math.min(NOTE_START_Y, topY - noteGap);
}

// 노트를 줄 맨 뒤(위쪽)로 돌려보내고, 레인(방향)을 무작위로 새로 고른다
function respawnNote(note) {
  // 동시 노트: 줄 맨 뒤 노트가 아직 레인 위에서 기다리는 중이고 혼자라면,
  // CHORD_CHANCE 확률로 그 노트와 같은 높이 · 다른 레인에 놓는다 → 두 키를 같이 눌러야 한다
  const last = lastNote(note);
  if (last && last.y <= NOTE_START_Y && Math.random() < CHORD_CHANCE) {
    note.y = last.y;
    // 1~3칸 옆 레인을 고른다 (4로 나눈 나머지를 써서 0~3 안에서 돈다) → 절대 같은 레인이 안 된다
    note.lane = (last.lane + 1 + Math.floor(Math.random() * (LANE_COUNT - 1))) % LANE_COUNT;
    return;
  }
  note.y = nextSpawnY(note);
  // Math.random()은 0 이상 1 미만의 아무 수 → 4를 곱하고 소수점을 버리면 0, 1, 2, 3 중 하나
  note.lane = Math.floor(Math.random() * LANE_COUNT);
}

// 줄 맨 뒤(가장 위)에 있는 화살표 노트. 단, Space 노트가 더 위에 있거나, 이미 동시 노트(2개)이면 없음(null)
function lastNote(except) {
  const others = notes.filter((n) => n !== except);
  const topY = Math.min(...others.map((n) => n.y));
  if (spaceNoteY <= topY) return null;
  const atTop = others.filter((n) => n.y === topY);
  return atTop.length === 1 ? atTop[0] : null;
}

// 게임 키 하나를 눌렀을 때 할 일: 그 방향 포즈를 취하고, 판정선 근처의 노트를 맞췄는지 확인한다
// 노트를 맞췄을 때: 판정선과의 거리로 정확도를 계산해 판정 등급을 정하고, 화면에 띄울 준비를 한다
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
  gradeCounts[judgeText] = gradeCounts[judgeText] + 1;       // 판정별 개수를 센다
  accuracySum = accuracySum + Math.max(0, accuracy);         // 정확도를 더한다 (판정 범위 끝보다 멀면 0으로)
  playerScore = playerScore + JUDGE_SCORES[judgeText];   // 판정별 점수를 내 점수에 더한다
  // 맞춘 자리에 이펙트를 하나 추가한다
  hitEffects.push({ x: effectX, y: JUDGE_Y, color: JUDGE_COLORS[judgeText], wide: wide, timer: HIT_EFFECT_FRAMES });
}

function pressKey(key) {
  if (key === " ") {
    playerPose = "player_space";
    // Space 노트 판정 사각형이 판정 영역(레인 전체 폭)과 겹치면 맞춘 것
    if (checkCollision(spaceHitbox(), judgeBox())) {
      const distance = Math.abs(spaceNoteY + 20 - judgeCenterY());   // 판정 등급은 판정 기준과의 거리로 정한다
      showJudge(distance, LANE_X + (LANE_WIDTH * LANE_COUNT) / 2, true);
      // 판정선을 지나기 전에 맞춰서 노트가 사라지면, 봇은 이 노트를 칠 기회가 없다 → 지금 봇도 치게 한다
      if (spaceNoteY + 20 < JUDGE_Y) botPlay("bot_space");
      spaceNoteY = nextSpawnY("space");
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
  // D: 디버그 표시 켜기/끄기 (꾹 눌러도 한 번만)
  if (key === "d" && !e.repeat) {
    showDebug = !showDebug;
    return;
  }
  if (!GAME_KEYS.includes(key)) return;   // 게임에 안 쓰는 키는 무시
  e.preventDefault();                    // 스페이스바로 페이지가 스크롤되지 않게 막는다
  if (INPUT_MODE === "A" && gameState === "playing") {
    pressKey(key);                       // 방식 A: 이벤트 안에서 바로 판정하고 포즈를 바꾼다
  }
  keys[key] = true;                      // 방식 B: "눌렸다"고 기록만 한다. 판정은 게임 루프가 한다
});

// 키에서 손을 떼는 순간 (keyup)
document.addEventListener("keyup", function (e) {
  keys[normalizeKey(e.key)] = false;     // "떼었다"고 기록한다
});

// 게임을 처음 상태로 되돌린다: 점수, 시간, 노트, 포즈, 판정 표시를 전부 처음 값으로
// (재시작할 때 gameLoop()를 또 부르면 루프가 두 개가 되어 게임이 두 배로 빨라진다. 그래서 gameState만 바꾼다)
function resetGame() {
  playerScore = 0;
  botScore = 0;
  notes = createNotes();
  spaceNoteY = lineY;            // Space 노트는 줄 맨 뒤에서 시작
  playerPose = "player";
  botPose = "bot";
  judgeTimer = 0;
  hitEffects = [];
  accuracySum = 0;               // 정확도 기록도 처음부터
  gradeCounts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
  passedNotes = 0;
  gameState = "countdown";       // 바로 시작하지 않고 3초 카운트다운부터
  countdownStart = Date.now();
}

// 카운트다운 화면: 화면 정중앙에 남은 초(3 → 2 → 1)를 크게 띄운다
// 일시정지 켜기/끄기. 결과 화면에서는 아무 일도 안 한다
function togglePause() {
  if (gameState === "countdown" || gameState === "playing") {
    pausedFrom = gameState;
    pauseStart = Date.now();
    gameState = "paused";
  } else if (gameState === "paused") {
    // 멈춰 있던 시간만큼 시작 시각을 뒤로 미룬다 → 남은 시간과 카운트다운이 멈춘 자리에서 이어진다
    const pausedTime = Date.now() - pauseStart;
    startTime = startTime + pausedTime;
    countdownStart = countdownStart + pausedTime;
    gameState = pausedFrom;
  }
}

// 일시정지 화면: 어두운 막 + 안내
function drawPause() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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

// 결과 화면: 무대 위에 어두운 막을 덮고, 가운데에 승패와 점수를 띄운다
function drawResult() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";           // 반투명 검은 막
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  let resultText = "패배…";
  let resultColor = "#8fd3ff";
  if (playerScore > botScore) {
    resultText = "승리!";
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
  ctx.fillText("R 키를 눌러 다시 시작", 400, 465);
}

// ===== 게임 루프: 지우기 → 계산 → 그리기를 1초에 약 60번 반복한다 =====
function gameLoop() {
  // ① 지우기: 이전 프레임에 그린 것을 모두 지운다
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ② 계산: 프레임 수를 세고, 키 입력을 판정하고, 노트를 속도만큼 아래로 내린다
  // (반짝이·관중 애니메이션과 판정 글자·이펙트는 결과 화면에서도 계속 움직인다)
  frameCount = frameCount + 1;
  if (judgeTimer > 0) judgeTimer = judgeTimer - 1;   // 판정 글자가 사라질 때까지 남은 시간을 줄인다
  for (const effect of hitEffects) effect.timer = effect.timer - 1;   // 이펙트 남은 시간을 줄이고
  hitEffects = hitEffects.filter((effect) => effect.timer > 0);      // 다 끝난 이펙트는 목록에서 뺀다

  // 카운트다운이 끝나면 플레이 시작: 이때부터 제한 시간을 잰다
  if (gameState === "countdown" && Date.now() - countdownStart >= COUNTDOWN_SECONDS * 1000) {
    gameState = "playing";
    startTime = Date.now();
  }

  // 플레이 중일 때만: 시간 확인, 키 판정, 노트 이동 (카운트다운·결과 화면에서는 노트가 멈춘다)
  if (gameState === "playing") {
    if (remainingTime() === 0) {
      gameState = "gameover";                         // 제한 시간이 끝났다 → 결과 화면으로
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

    // 먼저 모든 노트를 똑같이 내린 다음, 빠져나간 노트를 처리한다
    // (내리면서 바로 처리하면 아직 안 내린 노트와 높이가 어긋나 간격이 틀어진다)
    for (const note of notes) {
      const before = note.y + NOTE_SIZE / 2;         // 내리기 전 노트 가운데
      note.y = note.y + noteSpeed;
      // 노트 가운데가 이번 프레임에 판정선을 지나갔으면, 봇이 그 노트를 친다
      if (before < JUDGE_Y && note.y + NOTE_SIZE / 2 >= JUDGE_Y) {
        botPlay("bot_" + LANE_NAMES[note.lane]);
      }
    }
    const spaceBefore = spaceNoteY + 20;
    spaceNoteY = spaceNoteY + noteSpeed;
    if (spaceBefore < JUDGE_Y && spaceNoteY + 20 >= JUDGE_Y) {
      botPlay("bot_space");                          // Space 노트가 판정선을 지나가면 봇이 친다 (맞추면 팔 벌리기 포즈)
    }
    for (const note of notes) {
      // 레인 맨 아래로 빠져나가면 줄 맨 뒤로 돌아간다
      if (note.y > NOTE_END_Y) {                   // 노트 윗부분까지 레인 밖으로 다 나가면
        gradeCounts.MISS = gradeCounts.MISS + 1;   // 못 누르고 지나간 노트 → MISS로 센다 (정확도 0%)
        passedNotes = passedNotes + 1;
        respawnNote(note);
      }
    }
    if (spaceNoteY > NOTE_END_Y) {               // Space 노트도 레인 밖으로 다 나가면
      gradeCounts.MISS = gradeCounts.MISS + 1;
      passedNotes = passedNotes + 1;
      spaceNoteY = nextSpawnY("space");
    }
  } // if (gameState === "playing") 끝

  // ③ 그리기: 바뀐 위치대로 무대 전체를 다시 그린다. 결과 화면이면 그 위에 결과를 덮는다
  draw();
  if (gameState === "countdown") {
    drawCountdown();
  } else if (gameState === "paused") {
    drawPause();
  } else if (gameState === "gameover") {
    drawResult();
  }
  if (showDebug) {
    drawDebug();                       // 디버그 정보는 카운트다운·일시정지·결과 화면 위에도 보이게 맨 마지막에 그린다
  }

  // ④ 다음 프레임에 gameLoop를 또 불러 달라고 브라우저에 부탁한다
  requestAnimationFrame(gameLoop);
}
