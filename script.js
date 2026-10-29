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

let notes = [];
let lineY = 420;           // 줄을 세울 다음 위치. 판정선 근처(420)부터 위쪽으로 올라가며 세운다
for (let i = 0; i < NOTE_COUNT; i++) {
  // 레인 위(150)보다 위에 있는 노트는 아직 안 보이고, 줄을 서서 기다린다
  notes.push({ lane: Math.floor(Math.random() * 4), y: lineY });
  lineY = lineY - noteGap;
}
// ===== 입력과 판정 (5장) =====
const INPUT_MODE = "B";    // 조작 방식. "A" = 키 이벤트 안에서 바로 판정 (비교 실험용), "B" = keys에 기록하고 게임 루프에서 판정
const JUDGE_RANGE = 30;    // 노트 가운데가 판정선에서 이 거리(px) 안에 있을 때 키를 누르면 맞춘 것
const KEY_TO_LANE = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 }; // 방향키 → 레인 번호
const GAME_KEYS = ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight", " "];   // 게임에 쓰는 키 (" "는 스페이스바)
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

let botPose = "bot";      // 지금 봇이 하고 있는 포즈 (그림 이름). 노트가 지나갈 때마다 바뀐다
let frameCount = 0;        // 게임이 시작된 뒤 지난 프레임 수 (반짝이 깜빡임에 쓴다)
let spaceNoteY = lineY;    // Space 노트(레인 4개를 가로지르는 긴 막대)의 y. 줄 맨 뒤에서 시작한다
const CHORD_CHANCE = 0.2;  // 동시 노트(두 키를 같이 눌러야 하는 노트)가 나올 확률 (0.2 = 20%)
// 스테이지별 노트 속도 (속도 튜닝으로 정함): 초급 2 / 중급 4 / 상급 6
const STAGE_SPEEDS = [2, 4, 6];
let noteSpeed = STAGE_SPEEDS[0];   // 지금은 스테이지 1(초급). 노트가 한 프레임에 아래로 내려오는 거리
const NOTE_SIZE = 50;      // 노트 그림 크기 (가로 = 세로)
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
  note_left: "assets/note_left.png",
  note_down: "assets/note_down.png",
  note_up: "assets/note_up.png",
  note_right: "assets/note_right.png",
  note_space: "assets/note_space.png",
  target_left: "assets/target_left.png",
  target_down: "assets/target_down.png",
  target_up: "assets/target_up.png",
  target_right: "assets/target_right.png",
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
    if (loadedCount === totalCount) gameLoop();   // 그림을 다 불러온 뒤에 게임 루프를 시작한다
  };
  images[name].src = IMAGE_FILES[name];
}

// ===== 그리기 =====
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
  ctx.fillText("나: 0", 20, 35);                   // 왼쪽 위: 내 점수
  ctx.textAlign = "right";
  ctx.fillText("봇: 0", 780, 35);                  // 오른쪽 위: 봇 점수 (x=780에서 끝나게)
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("STAGE 1 초급", 400, 128);          // 가운데: 스테이지
  ctx.fillText("남은 시간: 90", 400, 146);         // 가운데: 남은 시간

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
    const x = laneLeft + (LANE_WIDTH - NOTE_SIZE) / 2; // 레인 가운데
    // 누르고 있는 레인의 과녁은 조금 작아져서 "눌린" 느낌을 준다
    const size = keys[GAME_KEYS[i]] ? NOTE_SIZE - 8 : NOTE_SIZE;
    ctx.drawImage(images["target_" + LANE_NAMES[i]], x + (NOTE_SIZE - size) / 2, JUDGE_Y - size / 2, size, size);
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
    ctx.drawImage(images["note_" + LANE_NAMES[note.lane]], x, note.y, NOTE_SIZE, NOTE_SIZE);
  }

  // 7. Space 노트: 레인 4개를 가로지르는 긴 막대 + 가운데에 Space 키 그림
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(LANE_X + 5, spaceNoteY + 14, LANE_WIDTH * LANE_COUNT - 10, 12);
  ctx.drawImage(images.note_space, DJ_X - 20, spaceNoteY, 40, 40);
  ctx.restore();                                         // clip을 풀고 원래 상태로 돌아간다

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

// ===== 게임 루프: 지우기 → 계산 → 그리기를 1초에 약 60번 반복한다 =====
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
  // 맞춘 자리에 이펙트를 하나 추가한다
  hitEffects.push({ x: effectX, y: JUDGE_Y, color: JUDGE_COLORS[judgeText], wide: wide, timer: HIT_EFFECT_FRAMES });
}

function pressKey(key) {
  if (key === " ") {
    playerPose = "player_space";
    // Space 노트의 가운데(그림 높이 40의 절반 = 20)가 판정선 근처에 있으면 맞춘 것
    const distance = Math.abs(spaceNoteY + 20 - JUDGE_Y);
    if (distance <= JUDGE_RANGE) {
      showJudge(distance, LANE_X + (LANE_WIDTH * LANE_COUNT) / 2, true);
      spaceNoteY = nextSpawnY("space");
    }
    return;
  }
  const lane = KEY_TO_LANE[key];
  playerPose = "player_" + LANE_NAMES[lane];
  for (const note of notes) {
    const noteCenter = note.y + NOTE_SIZE / 2;     // 노트 그림의 세로 가운데
    // 같은 방향이고, 가운데가 판정선에서 JUDGE_RANGE 안에 있으면 맞춘 것 → 노트를 위로 돌려보낸다
    const distance = Math.abs(noteCenter - JUDGE_Y);  // 판정선에서 몇 px 떨어져 있는가
    if (note.lane === lane && distance <= JUDGE_RANGE) {
      showJudge(distance, LANE_X + lane * LANE_WIDTH + LANE_WIDTH / 2, false);
      respawnNote(note);
      return;                                      // 한 번 누르면 노트 하나만 맞춘다
    }
  }
}

// 키를 누르는 순간 (keydown)
document.addEventListener("keydown", function (e) {
  console.log(e.key);                    // 5장 Step 1 확인용: 눌린 키 이름을 콘솔(F12)에 출력. 확인이 끝나면 이 줄을 지운다
  if (!GAME_KEYS.includes(e.key)) return; // 게임에 안 쓰는 키는 무시
  e.preventDefault();                    // 방향키·스페이스바로 페이지가 스크롤되지 않게 막는다
  if (INPUT_MODE === "A") {
    pressKey(e.key);                     // 방식 A: 이벤트 안에서 바로 판정하고 포즈를 바꾼다
  }
  keys[e.key] = true;                    // 방식 B: "눌렸다"고 기록만 한다. 판정은 게임 루프가 한다
});

// 키에서 손을 떼는 순간 (keyup)
document.addEventListener("keyup", function (e) {
  keys[e.key] = false;                   // "떼었다"고 기록한다
});

function gameLoop() {
  // ① 지우기: 이전 프레임에 그린 것을 모두 지운다
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ② 계산: 프레임 수를 세고, 키 입력을 판정하고, 노트를 속도만큼 아래로 내린다
  frameCount = frameCount + 1;
  if (judgeTimer > 0) judgeTimer = judgeTimer - 1;   // 판정 글자가 사라질 때까지 남은 시간을 줄인다
  for (const effect of hitEffects) effect.timer = effect.timer - 1;   // 이펙트 남은 시간을 줄이고
  hitEffects = hitEffects.filter((effect) => effect.timer > 0);      // 다 끝난 이펙트는 목록에서 뺀다

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
    // 노트 가운데가 이번 프레임에 판정선을 지나갔으면, 봇이 그 방향 포즈를 취한다 (봇이 노트를 친 것처럼)
    if (before < JUDGE_Y && note.y + NOTE_SIZE / 2 >= JUDGE_Y) {
      botPose = "bot_" + LANE_NAMES[note.lane];
    }
  }
  const spaceBefore = spaceNoteY + 20;
  spaceNoteY = spaceNoteY + noteSpeed;
  if (spaceBefore < JUDGE_Y && spaceNoteY + 20 >= JUDGE_Y) {
    botPose = "bot_space";                         // Space 노트가 판정선을 지나가면 팔 벌리기 포즈
  }
  for (const note of notes) {
    // 레인 맨 아래로 빠져나가면 줄 맨 뒤로 돌아간다
    if (note.y > NOTE_END_Y) {                   // 노트 윗부분까지 레인 밖으로 다 나가면
      respawnNote(note);
    }
  }
  if (spaceNoteY > NOTE_END_Y) {               // Space 노트도 레인 밖으로 다 나가면
    spaceNoteY = nextSpawnY("space");
  }

  // ③ 그리기: 바뀐 위치대로 무대 전체를 다시 그린다
  draw();

  // ④ 다음 프레임에 gameLoop를 또 불러 달라고 브라우저에 부탁한다
  requestAnimationFrame(gameLoop);
}
