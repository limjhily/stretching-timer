// PWA Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker Registered!', reg))
      .catch(err => console.error('Service Worker Registration Failed', err));
  });
}

// 상태 변수
let workouts = JSON.parse(localStorage.getItem('stretching_workouts')) || [];
let currentRoutine = [];
let currentIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let totalDuration = 0;
let isTimerRunning = false;

// DOM 요소 획득
const homeView = document.getElementById('home-view');
const addView = document.getElementById('add-view');
const playerView = document.getElementById('player-view');

const routineList = document.getElementById('routine-list');
const emptyState = document.getElementById('empty-state');
const startRoutineBtn = document.getElementById('start-routine-btn');

const workoutForm = document.getElementById('workout-form');
const editIdInput = document.getElementById('edit-id');
const youtubeUrlInput = document.getElementById('youtube-url');
const previewUrlBtn = document.getElementById('preview-url-btn');
const videoPreviewCard = document.getElementById('video-preview-card');
const videoThumbnail = document.getElementById('video-thumbnail');
const previewTitle = document.getElementById('preview-title');
const workoutTitleInput = document.getElementById('workout-title');
const workoutDurationInput = document.getElementById('workout-duration');
const durationVal = document.getElementById('duration-val');

const currentIndexLabel = document.getElementById('current-index-label');
const currentWorkoutTitle = document.getElementById('current-workout-title');
const timerTime = document.getElementById('timer-time');
const timerProgress = document.getElementById('timer-progress');
const timerPlayBtn = document.getElementById('timer-play-btn');
const playIcon = document.getElementById('play-icon');
const timerResetBtn = document.getElementById('timer-reset-btn');
const prevWorkoutBtn = document.getElementById('prev-workout-btn');
const nextWorkoutBtn = document.getElementById('next-workout-btn');

// 이벤트 리스너 등록
document.getElementById('go-add-btn').addEventListener('click', () => showAddView());
document.getElementById('cancel-add-btn').addEventListener('click', () => switchView('home'));
previewUrlBtn.addEventListener('click', loadYoutubePreview);
youtubeUrlInput.addEventListener('input', debounce(loadYoutubePreview, 800));
workoutDurationInput.addEventListener('input', updateDurationLabel);
workoutForm.addEventListener('submit', saveWorkout);
startRoutineBtn.addEventListener('click', startRoutine);

timerPlayBtn.addEventListener('click', toggleTimer);
timerResetBtn.addEventListener('click', resetTimer);
prevWorkoutBtn.addEventListener('click', () => navigateRoutine(-1));
nextWorkoutBtn.addEventListener('click', () => navigateRoutine(1));
document.getElementById('exit-player-btn').addEventListener('click', exitPlayer);



// 최초 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  renderWorkoutList();
  handleSharedTarget();
});

// 디바운스 함수 (유튜브 자동 감지용)
function debounce(func, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

// 뷰 전환
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  if (viewId === 'home') {
    homeView.classList.add('active');
    renderWorkoutList();
  } else if (viewId === 'add') {
    addView.classList.add('active');
  } else if (viewId === 'player') {
    playerView.classList.add('active');
  }
}

// 추가/수정 폼 활성화
function showAddView(workoutId = null) {
  workoutForm.reset();
  editIdInput.value = '';
  videoPreviewCard.classList.add('hidden');
  document.getElementById('add-view-title').textContent = '새 스트레칭 추가';
  workoutDurationInput.value = 60;
  updateDurationLabel();

  if (workoutId) {
    const item = workouts.find(w => w.id === workoutId);
    if (item) {
      document.getElementById('add-view-title').textContent = '스트레칭 수정';
      editIdInput.value = item.id;
      youtubeUrlInput.value = item.youtubeUrl;
      workoutTitleInput.value = item.title;
      workoutDurationInput.value = item.duration;
      updateDurationLabel();
      loadYoutubePreview();
    }
  }
  switchView('add');
}

// 슬라이더 라벨 업데이트
function updateDurationLabel() {
  const val = parseInt(workoutDurationInput.value, 10);
  durationVal.textContent = val;
  const min = Math.floor(val / 60);
  const sec = val % 60;
  document.querySelector('.duration-minmax').textContent = 
    `(${min > 0 ? min + '분 ' : ''}${sec.toString().padStart(2, '0')}초)`;
}

// 유튜브 비디오 ID 파싱
function extractVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// 유튜브 썸네일 미리보기 로드
function loadYoutubePreview() {
  const url = youtubeUrlInput.value.trim();
  const videoId = extractVideoId(url);
  
  if (videoId) {
    videoThumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    previewTitle.textContent = "영상을 확인했습니다. 정보를 저장해 주세요.";
    videoPreviewCard.classList.remove('hidden');
    
    // 비디오 이름을 임시로 채워넣기 (제목이 비어있을 때만)
    if (!workoutTitleInput.value) {
      workoutTitleInput.value = `스트레칭 동작 (${videoId})`;
    }
  } else {
    videoPreviewCard.classList.add('hidden');
  }
}

// 데이터 저장 (C/U)
function saveWorkout(e) {
  e.preventDefault();
  
  const id = editIdInput.value;
  const url = youtubeUrlInput.value.trim();
  const title = workoutTitleInput.value.trim();
  const duration = parseInt(workoutDurationInput.value, 10);
  const videoId = extractVideoId(url);

  if (!videoId) {
    alert('올바른 유튜브 링크를 입력해 주세요.');
    return;
  }

  const workoutData = {
    id: id || Date.now().toString(),
    title,
    youtubeUrl: url,
    videoId,
    duration
  };

  if (id) {
    // 수정
    workouts = workouts.map(w => w.id === id ? workoutData : w);
  } else {
    // 신규
    workouts.push(workoutData);
  }

  localStorage.setItem('stretching_workouts', JSON.stringify(workouts));
  switchView('home');
}

// 순서 변경 함수 (위/아래 이동)
function moveWorkout(id, direction) {
  const index = workouts.findIndex(w => w.id === id);
  if (index === -1) return;
  
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= workouts.length) return;
  
  // 배열 요소 스왑
  const temp = workouts[index];
  workouts[index] = workouts[targetIndex];
  workouts[targetIndex] = temp;
  
  localStorage.setItem('stretching_workouts', JSON.stringify(workouts));
  renderWorkoutList();
}

// 데이터 삭제 (D)
function deleteWorkout(id, e) {
  e.stopPropagation();
  if (confirm('이 스트레칭을 목록에서 삭제하시겠습니까?')) {
    workouts = workouts.filter(w => w.id !== id);
    localStorage.setItem('stretching_workouts', JSON.stringify(workouts));
    renderWorkoutList();
  }
}

// 스트레칭 리스트 렌더링
function renderWorkoutList() {
  if (workouts.length === 0) {
    emptyState.classList.remove('hidden');
    routineList.classList.add('hidden');
    startRoutineBtn.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    routineList.classList.remove('hidden');
    startRoutineBtn.classList.remove('hidden');
    
    routineList.innerHTML = '';
    workouts.forEach((workout, index) => {
      const min = Math.floor(workout.duration / 60);
      const sec = workout.duration % 60;
      const isFirst = index === 0;
      const isLast = index === workouts.length - 1;
      
      const card = document.createElement('div');
      card.className = 'routine-card';
      card.addEventListener('click', () => startSingleRoutine(workout.id));
      card.innerHTML = `
        <img class="card-thumbnail" src="https://img.youtube.com/vi/${workout.videoId}/mqdefault.jpg" alt="썸네일">
        <div class="card-info">
          <div class="card-title-row">
            <h3 class="card-title">${workout.title}</h3>
            <div class="card-actions">
              <button class="card-action-btn move-up" aria-label="위로 이동" ${isFirst ? 'disabled style="opacity: 0.2; pointer-events: none;"' : ''}>
                <span class="material-symbols-outlined">keyboard_arrow_up</span>
              </button>
              <button class="card-action-btn move-down" aria-label="아래로 이동" ${isLast ? 'disabled style="opacity: 0.2; pointer-events: none;"' : ''}>
                <span class="material-symbols-outlined">keyboard_arrow_down</span>
              </button>
              <button class="card-action-btn edit" aria-label="수정"><span class="material-symbols-outlined">edit</span></button>
              <button class="card-action-btn delete" aria-label="삭제"><span class="material-symbols-outlined">delete</span></button>
            </div>
          </div>
          <div class="card-duration">
            <span class="material-symbols-outlined">timer</span>
            <span>${min > 0 ? min + '분 ' : ''}${sec > 0 ? sec + '초' : '0초'}</span>
          </div>
        </div>
      `;
      
      card.querySelector('.move-up').addEventListener('click', (e) => {
        e.stopPropagation();
        moveWorkout(workout.id, -1);
      });
      card.querySelector('.move-down').addEventListener('click', (e) => {
        e.stopPropagation();
        moveWorkout(workout.id, 1);
      });
      card.querySelector('.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        showAddView(workout.id);
      });
      card.querySelector('.delete').addEventListener('click', (e) => deleteWorkout(workout.id, e));
      
      routineList.appendChild(card);
    });
  }
}

// 유튜브 앱 등에서의 Share Target 처리
function handleSharedTarget() {
  const params = new URLSearchParams(window.location.search);
  const sharedUrl = params.get('url') || params.get('text');
  
  if (sharedUrl) {
    // 유튜브 공유 시 텍스트와 섞여오는 경우 URL만 추출
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const matched = sharedUrl.match(urlPattern);
    const cleanUrl = matched ? matched[0] : sharedUrl;
    
    if (extractVideoId(cleanUrl)) {
      showAddView();
      youtubeUrlInput.value = cleanUrl;
      loadYoutubePreview();
      
      // 주소창 파라미터 깔끔하게 제거
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}

// ----------------- 루틴 플레이어 로직 -----------------

// 전체 루틴 시작
function startRoutine() {
  if (workouts.length === 0) return;
  currentRoutine = [...workouts];
  currentIndex = 0;
  loadWorkout(currentIndex);
  switchView('player');
}

// 단일 동작 바로 시작
function startSingleRoutine(workoutId) {
  const target = workouts.find(w => w.id === workoutId);
  if (!target) return;
  currentRoutine = [target];
  currentIndex = 0;
  loadWorkout(currentIndex);
  switchView('player');
}

// 특정 인덱스의 운동 데이터 로딩
function loadWorkout(index) {
  // 타이머 초기화
  stopTimer();
  
  const workout = currentRoutine[index];
  totalDuration = workout.duration;
  timeLeft = totalDuration;
  
  // 화면 갱신
  currentIndexLabel.textContent = `${index + 1}/${currentRoutine.length}`;
  currentWorkoutTitle.textContent = workout.title;
  updateTimerDisplay();
  
  // 이전 / 다음 버튼 활성화 여부
  prevWorkoutBtn.disabled = index === 0;
  if (index === currentRoutine.length - 1) {
    nextWorkoutBtn.querySelector('span').textContent = '완료';
    nextWorkoutBtn.querySelector('.material-symbols-outlined').textContent = 'check';
  } else {
    nextWorkoutBtn.querySelector('span').textContent = '다음 동작';
    nextWorkoutBtn.querySelector('.material-symbols-outlined').textContent = 'navigate_next';
  }

  // 유튜브 플레이어 로드/전환
  loadYoutubeVideo(workout.videoId);
}

// 유튜브 비디오 로드 (직접 iframe src 제어)
function loadYoutubeVideo(videoId) {
  const player = document.getElementById('youtube-player');
  if (player) {
    player.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&playsinline=1&enablejsapi=0`;
  }
}

// 타이머 일시정지 / 재생 토글
function toggleTimer() {
  if (isTimerRunning) {
    stopTimer();
  } else {
    startTimer();
  }
}

// 타이머 작동
function startTimer() {
  if (isTimerRunning) return;
  isTimerRunning = true;
  playIcon.textContent = 'pause';
  
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    
    if (timeLeft <= 0) {
      stopTimer();
      triggerAlert();
      
      // 마지막 동작인 경우 자동으로 홈 화면 이동
      if (currentIndex === currentRoutine.length - 1) {
        setTimeout(() => {
          alert('모든 스트레칭을 성공적으로 마쳤습니다! 고생하셨습니다.');
          exitPlayer();
        }, 1500);
      }
    }
  }, 1000);
}

// 타이머 정지
function stopTimer() {
  isTimerRunning = false;
  playIcon.textContent = 'play_arrow';
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// 타이머 초기화
function resetTimer() {
  stopTimer();
  timeLeft = totalDuration;
  updateTimerDisplay();
}

// 타이머 화면 및 원형 링 업데이트
function updateTimerDisplay() {
  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;
  timerTime.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  
  // 원형 진행바 갱신 (반지름 r=85 => 둘레 534)
  const strokeDashoffset = 534 * (1 - (timeLeft / totalDuration));
  timerProgress.style.strokeDashoffset = strokeDashoffset;

  // 10초 미만 경고 스타일 적용
  if (timeLeft < 10 && timeLeft > 0) {
    timerProgress.classList.add('warning');
  } else {
    timerProgress.classList.remove('warning');
  }
}

// 이전/다음 이동
function navigateRoutine(direction) {
  const nextIndex = currentIndex + direction;
  
  if (nextIndex >= 0 && nextIndex < currentRoutine.length) {
    currentIndex = nextIndex;
    loadWorkout(currentIndex);
  } else if (nextIndex >= currentRoutine.length) {
    // 루틴 전체 완료
    alert('모든 스트레칭을 성공적으로 마쳤습니다! 고생하셨습니다.');
    exitPlayer();
  }
}

// 루틴 플레이어 나가기
function exitPlayer() {
  stopTimer();
  const player = document.getElementById('youtube-player');
  if (player) {
    player.src = '';
  }
  switchView('home');
}

// ----------------- 피드백 및 기기 제어 알림 -----------------

// 타이머 만료 알림 트리거 (소리 & 진동)
function triggerAlert() {
  playAlertSound();
  vibrateDevice();
}

// Web Audio API를 활용한 기분 좋은 3화음 비프 알림음 발생
function playAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // 맑은 도-미-솔 3연음 연주
    playTone(523.25, now, 0.3);        // C5
    playTone(659.25, now + 0.12, 0.3); // E5
    playTone(783.99, now + 0.24, 0.5); // G5
  } catch (err) {
    console.error('AudioContext play failed', err);
  }
}

// 진동 알림
function vibrateDevice() {
  if ('vibrate' in navigator) {
    // [200ms 진동, 100ms 대기, 200ms 진동, 100ms 대기, 400ms 진동]
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}
