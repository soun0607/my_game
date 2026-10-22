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
let notes = [
  { lane: 1, y: 180 },
  { lane: 0, y: 250 },
  { lane: 2, y: 300 },
  { lane: 3, y: 380 },
];
let spaceNoteY = 430;      // Space 노트(레인 4개를 가로지르는 긴 막대)의 y
// 스테이지별 노트 속도 (속도 튜닝으로 정함): 초급 2 / 중급 4 / 상급 6
const STAGE_SPEEDS = [2, 4, 6];
let noteSpeed = STAGE_SPEEDS[0];   // 지금은 스테이지 1(초급). 노트가 한 프레임에 아래로 내려오는 거리
const NOTE_SIZE = 50;      // 노트 그림 크기 (가로 = 세로)
const NOTE_START_Y = LANE_TOP;                // 노트가 다시 나타나는 y (레인 맨 위)
const NOTE_END_Y = LANE_TOP + LANE_HEIGHT;    // 노트가 사라지는 y (레인 맨 아래)

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
const CROWD_Y = 530;       // 관중 그림 위쪽 y (아래가 화면 밖으로 잘려 머리만 보인다)
const CROWD_GAP = 62;      // 관중 사이 간격
const CROWD_WIDTH = 72;    // 관중 그림 가로 (원본 96의 3/4)
const CROWD_HEIGHT = 96;   // 관중 그림 세로 (원본 128의 3/4)

// 색
const STAGE_COLOR = "#2a1b3d";   // 무대 배경 (어두운 보라)

// ===== 그림 파일 불러오기 =====
// 무료 에셋: Kenney (www.kenney.nl), CC0 라이선스. 출처는 README.md에 적어 두었다.
const IMAGE_FILES = {
  player: "assets/player.png",
  bot: "assets/bot.png",
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

  // 1-1. 반짝이: 무대 위쪽 여기저기에 반투명 별
  // [x, y, 크기]
  const SPARKLES = [[70, 120, 40], [230, 70, 28], [560, 80, 32], [720, 130, 44], [600, 240, 24], [190, 260, 22]];
  ctx.globalAlpha = 0.5;                         // 이후 그림을 50%만 보이게
  for (const [x, y, size] of SPARKLES) {
    ctx.drawImage(images.sparkle, x - size / 2, y - size / 2, size, size);
  }
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
  ctx.textAlign = "left";
  ctx.fillText("실패: 0/5", 20, 62);               // 내 실패 횟수
  ctx.textAlign = "right";
  ctx.fillText("실패: 0/5", 780, 62);              // 봇 실패 횟수
  ctx.textAlign = "center";
  ctx.fillText("STAGE 1 초급", 400, 128);          // 가운데: 스테이지
  ctx.fillText("남은 시간: 60", 400, 146);         // 가운데: 남은 시간

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
    const x = LANE_X + i * LANE_WIDTH + (LANE_WIDTH - NOTE_SIZE) / 2; // 레인 가운데
    ctx.drawImage(images["target_" + LANE_NAMES[i]], x, JUDGE_Y - NOTE_SIZE / 2, NOTE_SIZE, NOTE_SIZE);
  }

  // 6. 노트: 레인 위에 내려오는 중인 화살표 키 그림
  for (const note of notes) {
    const x = LANE_X + note.lane * LANE_WIDTH + (LANE_WIDTH - NOTE_SIZE) / 2;
    ctx.drawImage(images["note_" + LANE_NAMES[note.lane]], x, note.y, NOTE_SIZE, NOTE_SIZE);
  }

  // 7. Space 노트: 레인 4개를 가로지르는 긴 막대 + 가운데에 Space 키 그림
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(LANE_X + 5, spaceNoteY + 14, LANE_WIDTH * LANE_COUNT - 10, 12);
  ctx.drawImage(images.note_space, DJ_X - 20, spaceNoteY, 40, 40);

  // 8. 댄서: 나(왼쪽)와 봇(오른쪽). 그림의 가운데 아래가 발끝 위치에 오게 그린다
  const dancerTop = DANCER_FEET_Y - DANCER_HEIGHT;
  ctx.drawImage(images.player, PLAYER_X - DANCER_WIDTH / 2, dancerTop, DANCER_WIDTH, DANCER_HEIGHT);
  ctx.drawImage(images.bot, BOT_X - DANCER_WIDTH / 2, dancerTop, DANCER_WIDTH, DANCER_HEIGHT);
  ctx.fillStyle = "white";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("나", PLAYER_X, dancerTop + 30);    // 머리 위 이름표 (그림 위쪽에 빈 공간이 있어 조금 내린다)
  ctx.fillText("초급 봇", BOT_X, dancerTop + 30);

  // 9. 관중: 무대를 바라보는 뒷모습 4종을 번갈아 한 줄로 세운다
  const crowd = [images.crowd1, images.crowd2, images.crowd3, images.crowd4];
  for (let i = 0; i * CROWD_GAP < canvas.width + CROWD_GAP; i++) {
    ctx.drawImage(crowd[i % 4], i * CROWD_GAP - 28, CROWD_Y, CROWD_WIDTH, CROWD_HEIGHT);
  }
}

// ===== 게임 루프: 지우기 → 계산 → 그리기를 1초에 약 60번 반복한다 =====
function gameLoop() {
  // ① 지우기: 이전 프레임에 그린 것을 모두 지운다
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ② 계산: 노트를 속도만큼 아래로 내린다
  for (const note of notes) {
    note.y = note.y + noteSpeed;
    // 레인 맨 아래로 빠져나가면 레인 맨 위에서 다시 나타난다
    if (note.y + NOTE_SIZE > NOTE_END_Y) {
      note.y = NOTE_START_Y;
      // 다시 나타날 때 레인을 무작위로 고른다 (0~3 중 하나: ← ↓ ↑ →)
      // Math.random()은 0 이상 1 미만의 아무 수 → 4를 곱하고 소수점을 버리면 0, 1, 2, 3 중 하나
      note.lane = Math.floor(Math.random() * LANE_COUNT);
    }
  }
  spaceNoteY = spaceNoteY + noteSpeed;
  if (spaceNoteY + 40 > NOTE_END_Y) {          // Space 노트 그림 높이는 40
    spaceNoteY = NOTE_START_Y;
  }

  // ③ 그리기: 바뀐 위치대로 무대 전체를 다시 그린다
  draw();

  // ④ 다음 프레임에 gameLoop를 또 불러 달라고 브라우저에 부탁한다
  requestAnimationFrame(gameLoop);
}
