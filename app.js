function toggleMenu() {
    const nav = document.getElementById('mainNav');
    if (nav) nav.classList.toggle('open');
}

const AUTH_USER_KEY = 'brainBloomAuthUser';
const AUTH_USERS_KEY = 'brainBloomUsers';
const DEFAULT_USERS = {
    student: '12345',
    admin: 'admin123'
};

function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}

function getRegisteredUsers() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_USERS_KEY)) || {};
    } catch {
        return {};
    }
}

function saveRegisteredUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function setAuthMessage(id, message) {
    const box = document.getElementById(id);
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
}

function initAuthPage() {
    const form = document.getElementById('authForm');
    if (!form) return;

    if (localStorage.getItem(AUTH_USER_KEY)) {
        window.location.href = 'dashboard.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') === 'register' ? 'register' : 'login';
    const isRegister = mode === 'register';
    const registered = params.get('registered') === '1';

    document.getElementById('authTitle').textContent = isRegister ? 'Create Account' : 'Login';
    document.getElementById('authAction').value = mode;
    document.getElementById('authButton').textContent = isRegister ? 'Create Account' : 'Login';
    document.getElementById('loginTools').style.display = isRegister ? 'none' : '';
    document.getElementById('authSwitch').innerHTML = isRegister
        ? 'Already have an account? <a href="index.html">Login</a>'
        : 'Do not have an account? <a href="index.html?mode=register">Create Account</a>';
    if (registered && !isRegister) {
        setAuthMessage('authSuccess', 'Account created. Please login with your new account.');
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        setAuthMessage('authError', '');
        setAuthMessage('authSuccess', '');

        const action = document.getElementById('authAction').value;
        const username = normalizeUsername(form.elements.username.value);
        const password = String(form.elements.password.value || '').trim();
        const registeredUsers = getRegisteredUsers();

        if (!username || !password) {
            setAuthMessage('authError', 'Please enter a username and password.');
            return;
        }

        if (action === 'register') {
            if (DEFAULT_USERS[username] || registeredUsers[username]) {
                setAuthMessage('authError', 'This username already exists. Please login or choose another username.');
                return;
            }

            registeredUsers[username] = {
                password,
                createdAt: new Date().toISOString()
            };
            saveRegisteredUsers(registeredUsers);
            window.location.href = 'index.html?registered=1';
            return;
        }

        const isDefaultUser = DEFAULT_USERS[username] === password;
        const isRegisteredUser = registeredUsers[username]?.password === password;

        if (!isDefaultUser && !isRegisteredUser) {
            setAuthMessage('authError', 'Invalid username or password.');
            return;
        }

        localStorage.setItem(AUTH_USER_KEY, username);
        window.location.href = 'dashboard.html';
    });
}

function logoutUser(event) {
    if (event) event.preventDefault();
    localStorage.removeItem(AUTH_USER_KEY);
    window.location.href = 'index.html';
}

function currentUserKey() {
    return String(window.currentUser || localStorage.getItem(AUTH_USER_KEY) || 'guest').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function storageKey(key) {
    return `pomodoroStudy:${currentUserKey()}:${key}`;
}

function readStore(key, fallback = []) {
    try {
        const scopedKey = storageKey(key);
        const scopedValue = localStorage.getItem(scopedKey);

        if (scopedValue !== null) {
            return JSON.parse(scopedValue);
        }

        const oldValue = localStorage.getItem(key);
        if (oldValue !== null) {
            localStorage.setItem(scopedKey, oldValue);
            return JSON.parse(oldValue);
        }

        return fallback;
    } catch {
        return fallback;
    }
}

function writeStore(key, value) {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function formatMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
}

function todayKey(dateValue = new Date()) {
    return new Date(dateValue).toLocaleDateString('en-CA');
}

function makeChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return;
    new Chart(canvas, {
        ...config,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            ...(config.options || {})
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initAuthPage();
    const welcomeUser = document.getElementById('welcomeUser');
    if (welcomeUser) welcomeUser.textContent = window.currentUser || localStorage.getItem(AUTH_USER_KEY) || 'student';
    initTimerFromPlanner();
    renderStudyPlans();
    renderTodos();
    renderDashboard();
});

function getStudyPlans() {
    return readStore('studyPlans');
}

function saveStudyPlans(plans) {
    writeStore('studyPlans', plans);
}

function addStudyPlan(event) {
    event.preventDefault();

    const subject = document.getElementById('planSubject').value.trim();
    const focus = document.getElementById('planFocus').value.trim();
    const date = document.getElementById('planDate').value;
    const hours = Number(document.getElementById('planHours').value || 0);
    const minutes = Number(document.getElementById('planMinutes').value || 0);
    const totalMinutes = (hours * 60) + minutes;

    if (!subject || !focus || !date || totalMinutes <= 0) {
        alert('Please complete the planner details.');
        return;
    }

    const plans = getStudyPlans();
    plans.push({
        id: Date.now().toString(),
        subject,
        focus,
        date,
        minutes: totalMinutes,
        status: 'Pending',
        completedMinutes: 0,
        createdAt: new Date().toISOString()
    });

    saveStudyPlans(plans);
    event.target.reset();
    document.getElementById('planHours').value = 0;
    document.getElementById('planMinutes').value = 25;
    renderStudyPlans();
}

function renderStudyPlans() {
    const table = document.getElementById('studyPlanTable');
    if (!table) return;

    const plans = getStudyPlans();
    if (!plans.length) {
        table.innerHTML = '<tr><td colspan="6" class="empty-cell">No study planner yet.</td></tr>';
        return;
    }

    table.innerHTML = plans.map(plan => `
        <tr>
            <td>${escapeHtml(plan.date)}</td>
            <td>${escapeHtml(plan.subject)}</td>
            <td>${escapeHtml(plan.focus)}</td>
            <td>${formatMinutes(plan.minutes)}</td>
            <td><span class="status status-${plan.status.toLowerCase().replaceAll(' ', '-')}">${escapeHtml(plan.status)}</span></td>
            <td class="table-actions">
                <button type="button" class="primary-btn small-btn" onclick="startPlan('${plan.id}')">Start</button>
                <button type="button" class="secondary-btn small-btn" onclick="markPlanDone('${plan.id}')">Done</button>
                <button type="button" class="secondary-btn small-btn" onclick="deletePlan('${plan.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function startPlan(planId) {
    const plans = getStudyPlans();
    const plan = plans.find(item => item.id === planId);
    if (!plan) return;

    plan.status = 'In Progress';
    saveStudyPlans(plans);

    const params = new URLSearchParams({
        mode: 'custom',
        planId: plan.id,
        minutes: plan.minutes,
        subject: plan.subject,
        focus: plan.focus
    });

    window.location.href = `timer.html?${params.toString()}`;
}

function markPlanDone(planId) {
    const plans = getStudyPlans();
    const plan = plans.find(item => item.id === planId);
    if (!plan) return;

    plan.status = 'Completed';
    plan.completedMinutes = Math.max(plan.completedMinutes || 0, plan.minutes);
    plan.completedAt = new Date().toISOString();
    saveStudyPlans(plans);
    if (!hasTimerSessionForPlan(plan.id)) {
        addTimerSession('study', plan.minutes * 60, plan.id, plan.subject);
    }
    renderStudyPlans();
}

function deletePlan(planId) {
    const plans = getStudyPlans().filter(item => item.id !== planId);
    saveStudyPlans(plans);
    renderStudyPlans();
}

let timerSeconds = 25 * 60;
let remainingSeconds = timerSeconds;
let timerId = null;
let timerMode = 'pomodoro';
let linkedPlanId = null;
let linkedPlanSubject = '';

function initTimerFromPlanner() {
    if (!document.getElementById('timerDisplay')) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') !== 'custom') {
        updateTimerDisplay();
        return;
    }

    const minutes = Math.max(1, Number(params.get('minutes') || 25));
    const hoursInput = document.getElementById('hours');
    const minutesInput = document.getElementById('minutes');
    const secondsInput = document.getElementById('seconds');

    if (hoursInput) hoursInput.value = Math.floor(minutes / 60);
    if (minutesInput) minutesInput.value = minutes % 60;
    if (secondsInput) secondsInput.value = 0;

    linkedPlanId = params.get('planId');
    linkedPlanSubject = params.get('subject') || '';
    setTimerMode('custom');

    const linkedLabel = document.getElementById('linkedPlanLabel');
    if (linkedLabel) {
        linkedLabel.textContent = `Planner: ${params.get('subject') || 'Study'} - ${params.get('focus') || 'Focus session'}`;
    }

    if (linkedPlanId) updatePlanStatus(linkedPlanId, 'In Progress');
}

function setTimerMode(mode) {
    timerMode = mode;
    clearInterval(timerId);
    timerId = null;

    document.querySelectorAll('.segmented button').forEach(button => {
        button.classList.toggle('active', button.dataset.mode === mode);
    });

    const customInputs = document.getElementById('customInputs');
    const label = document.getElementById('timerLabel');

    if (mode === 'pomodoro') {
        timerSeconds = 25 * 60;
        customInputs?.classList.remove('show');
        if (label) label.textContent = 'Pomodoro focus session';
        linkedPlanId = null;
        linkedPlanSubject = '';
        const linkedLabel = document.getElementById('linkedPlanLabel');
        if (linkedLabel) linkedLabel.textContent = '';
    } else {
        timerSeconds = readCustomSeconds();
        customInputs?.classList.add('show');
        if (label) label.textContent = 'Custom study session';
    }

    remainingSeconds = timerSeconds;
    updateTimerDisplay();
    setTimerAlert('Timer ready.');
}

function readCustomSeconds() {
    const h = Number(document.getElementById('hours')?.value || 0);
    const m = Number(document.getElementById('minutes')?.value || 0);
    const s = Number(document.getElementById('seconds')?.value || 0);
    return Math.max(1, (h * 3600) + (m * 60) + s);
}

function startTimer() {
    if (timerMode === 'custom') {
        if (remainingSeconds === timerSeconds || remainingSeconds <= 0) {
            timerSeconds = readCustomSeconds();
            remainingSeconds = timerSeconds;
        }
    }

    clearInterval(timerId);
    setTimerAlert('Timer started. Stay focused.');
    if (linkedPlanId) updatePlanStatus(linkedPlanId, 'In Progress');

    timerId = setInterval(() => {
        if (remainingSeconds <= 0) {
            finishTimer();
            return;
        }

        remainingSeconds--;
        updateTimerDisplay();
    }, 1000);
}

function finishTimer() {
    clearInterval(timerId);
    timerId = null;
    setTimerAlert('Time is finished. Take a break.');

    if (linkedPlanId) {
        completeLinkedPlan();
    } else {
        addTimerSession(timerMode === 'pomodoro' ? 'pomodoro' : 'study', timerSeconds, null, timerMode === 'pomodoro' ? 'Pomodoro' : 'Study Timer');
    }

    alert('Time is finished. Take a break.');
}

function pauseTimer() {
    clearInterval(timerId);
    timerId = null;
    setTimerAlert('Timer paused.');
}

function resetTimer() {
    clearInterval(timerId);
    timerId = null;
    timerSeconds = timerMode === 'pomodoro' ? 25 * 60 : readCustomSeconds();
    remainingSeconds = timerSeconds;
    updateTimerDisplay();
    setTimerAlert('Timer reset.');
}

function updateTimerDisplay() {
    const display = document.getElementById('timerDisplay');
    if (!display) return;

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    display.textContent = hours > 0
        ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function setTimerAlert(message) {
    const alertBox = document.getElementById('timerAlert');
    if (alertBox) alertBox.textContent = message;
}

function updatePlanStatus(planId, status) {
    const plans = getStudyPlans();
    const plan = plans.find(item => item.id === planId);
    if (!plan) return;

    plan.status = status;
    saveStudyPlans(plans);
}

function completeLinkedPlan() {
    const plans = getStudyPlans();
    const plan = plans.find(item => item.id === linkedPlanId);
    if (!plan) return;

    plan.status = 'Completed';
    plan.completedMinutes = Math.max(plan.completedMinutes || 0, Math.round(timerSeconds / 60));
    plan.completedAt = new Date().toISOString();
    saveStudyPlans(plans);
    if (!hasTimerSessionForPlan(plan.id)) {
        addTimerSession('study', timerSeconds, plan.id, plan.subject);
    }
}

function addTimerSession(type, seconds, planId = null, subject = 'Study Timer') {
    const sessions = readStore('timerSessions');
    sessions.push({
        id: Date.now().toString(),
        type,
        seconds,
        minutes: Math.round(seconds / 60),
        planId,
        subject,
        date: todayKey(),
        createdAt: new Date().toISOString()
    });
    writeStore('timerSessions', sessions);
}

function hasTimerSessionForPlan(planId) {
    return readStore('timerSessions').some(session => session.planId === planId);
}

function getTodos() {
    return readStore('studyTodos');
}

function saveTodos(todos) {
    writeStore('studyTodos', todos);
}

function addTodo(event) {
    event.preventDefault();
    const input = document.getElementById('todoInput');
    const priorityInput = document.getElementById('todoPriority');
    const dueDateInput = document.getElementById('todoDueDate');
    const text = input.value.trim();
    if (!text) return;

    const todos = getTodos();
    todos.push({
        text,
        done: false,
        priority: priorityInput?.value || 'none',
        dueDate: dueDateInput?.value || '',
        createdAt: new Date().toISOString()
    });
    saveTodos(todos);
    input.value = '';
    if (priorityInput) priorityInput.value = 'none';
    if (dueDateInput) dueDateInput.value = '';
    renderTodos();
}

function toggleTodo(index) {
    const todos = getTodos();
    todos[index].done = !todos[index].done;
    todos[index].completedAt = todos[index].done ? new Date().toISOString() : '';
    saveTodos(todos);
    renderTodos();
}

function deleteTodo(index) {
    const todos = getTodos();
    todos.splice(index, 1);
    saveTodos(todos);
    renderTodos();
}

function renderTodos() {
    const list = document.getElementById('todoList');
    if (!list) return;

    const todos = getTodos();
    if (!todos.length) {
        list.innerHTML = '<li><span>No to-do tasks yet.</span></li>';
        return;
    }

    const priorityRank = { important: 1, medium: 2, none: 3 };
    const sortedTodos = todos
        .map((todo, index) => ({ ...todo, originalIndex: index }))
        .sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;

            const priorityDifference = (priorityRank[a.priority || 'none'] || 3) - (priorityRank[b.priority || 'none'] || 3);
            if (priorityDifference !== 0) return priorityDifference;

            if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;

            return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        });

    list.innerHTML = sortedTodos.map(todo => `
        <li class="${todo.done ? 'done' : ''}">
            <div class="todo-main">
                <span>${escapeHtml(todo.text)}</span>
                <div class="todo-meta">
                    <strong class="priority priority-${escapeHtml(todo.priority || 'none')}">${formatPriority(todo.priority)}</strong>
                    <small>${todo.dueDate ? `Due: ${escapeHtml(todo.dueDate)}` : 'No due date'}</small>
                </div>
            </div>
            <div class="todo-actions">
                <button type="button" class="secondary-btn" onclick="toggleTodo(${todo.originalIndex})">${todo.done ? 'Undo' : 'Done'}</button>
                <button type="button" class="secondary-btn" onclick="deleteTodo(${todo.originalIndex})">Delete</button>
            </div>
        </li>
    `).join('');
}

function formatPriority(priority) {
    if (priority === 'important') return 'Important';
    if (priority === 'medium') return 'Medium';
    return 'No priority';
}

function sumBy(items, keyName, valueName) {
    return items.reduce((totals, item) => {
        const key = item[keyName] || 'Other';
        totals[key] = (totals[key] || 0) + Number(item[valueName] || 0);
        return totals;
    }, {});
}

function countBy(items, keyName) {
    return items.reduce((totals, item) => {
        const key = item[keyName] || 'Other';
        totals[key] = (totals[key] || 0) + 1;
        return totals;
    }, {});
}

function chartDataFromObject(source, emptyLabel = 'No data') {
    const labels = Object.keys(source);
    const values = Object.values(source);
    return {
        labels: labels.length ? labels : [emptyLabel],
        values: values.length ? values : [0]
    };
}

function daysBetween(dateValue, compareValue = new Date()) {
    const date = new Date(dateValue + 'T00:00:00');
    const compare = new Date(todayKey(compareValue) + 'T00:00:00');
    return Math.round((date - compare) / 86400000);
}

function calculateStreak(sessions) {
    const activeDays = new Set(sessions.map(session => session.date));
    let streak = 0;
    const cursor = new Date();

    while (activeDays.has(todayKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
}

function latestActiveDate(sessions) {
    return sessions
        .map(session => session.date)
        .filter(Boolean)
        .sort()
        .pop() || '';
}

function checkStreakBreak(sessions) {
    const latestDate = latestActiveDate(sessions);
    if (!latestDate) return;

    const missedDays = daysBetween(latestDate) * -1;
    if (missedDays < 2) return;

    const alertKey = `streakBreakAlert:${latestDate}`;
    if (readStore(alertKey, false)) return;

    alert('Your focus streak was extinguished because you missed a day. Start a timer today to light it again.');
    writeStore(alertKey, true);
}

function renderEmpty(container, message) {
    if (container) container.innerHTML = `<div class="mini-empty">${message}</div>`;
}

function updateFocusScore(score, text) {
    const scoreBox = document.getElementById('focusScore');
    const scoreText = document.getElementById('focusScoreText');
    if (!scoreBox) return;

    scoreBox.style.setProperty('--score', `${Math.min(100, Math.max(0, score))}%`);
    scoreBox.querySelector('span').textContent = Math.round(score);
    if (scoreText) scoreText.textContent = text;
}

function renderStreakBoard(sessions) {
    const board = document.getElementById('streakBoard');
    if (!board) return;

    const activeDays = new Set(sessions.map(session => session.date));
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = todayKey(date);
        return { key, label: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1), active: activeDays.has(key) };
    });

    board.innerHTML = days.map(day => `
        <span class="${day.active ? 'active' : ''}" title="${day.key}">
            ${day.label}
        </span>
    `).join('');
}

function updateStreakFlame(streak) {
    const flame = document.getElementById('streakFlame');
    const title = document.getElementById('streakTitle');
    if (!flame) return;

    flame.classList.toggle('extinguished', streak === 0);
    flame.querySelector('span').textContent = streak;
    if (title) title.textContent = streak ? `${streak} Day Streak!` : 'Streak extinguished';
}

function renderPriorityBars(todos) {
    const container = document.getElementById('priorityBars');
    if (!container) return;

    const counts = {
        important: todos.filter(todo => todo.priority === 'important' && !todo.done).length,
        medium: todos.filter(todo => todo.priority === 'medium' && !todo.done).length,
        none: todos.filter(todo => (!todo.priority || todo.priority === 'none') && !todo.done).length
    };
    const max = Math.max(1, ...Object.values(counts));
    const labels = { important: 'Important', medium: 'Medium', none: 'No priority' };

    container.innerHTML = Object.entries(counts).map(([key, value]) => `
        <div class="priority-row">
            <div><strong>${labels[key]}</strong><span>${value} active task${value === 1 ? '' : 's'}</span></div>
            <div class="priority-track"><i class="priority-fill priority-${key}" style="width:${(value / max) * 100}%"></i></div>
        </div>
    `).join('');
}

function renderDueSoon(todos) {
    const container = document.getElementById('dueSoonList');
    if (!container) return;

    const dueSoon = todos
        .filter(todo => !todo.done && todo.dueDate)
        .map(todo => ({ ...todo, daysLeft: daysBetween(todo.dueDate) }))
        .filter(todo => todo.daysLeft >= 0)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5);

    if (!dueSoon.length) {
        renderEmpty(container, 'No active due dates yet.');
        return;
    }

    container.innerHTML = dueSoon.map(todo => `
        <div class="due-item">
            <div>
                <strong>${escapeHtml(todo.text)}</strong>
                <span>${escapeHtml(formatPriority(todo.priority))}</span>
            </div>
            <b>${todo.daysLeft === 0 ? 'Today' : `${todo.daysLeft}d`}</b>
        </div>
    `).join('');
}

function renderSubjectProgress(plans) {
    const container = document.getElementById('subjectProgressList');
    if (!container) return;

    const subjects = plans.reduce((result, plan) => {
        const key = plan.subject || 'Other';
        if (!result[key]) result[key] = { planned: 0, completed: 0 };
        result[key].planned += Number(plan.minutes || 0);
        result[key].completed += Number(plan.completedMinutes || 0);
        return result;
    }, {});

    const entries = Object.entries(subjects);
    if (!entries.length) {
        renderEmpty(container, 'Add planner items to see subject progress.');
        return;
    }

    container.innerHTML = entries.map(([subject, item]) => {
        const percent = item.planned ? Math.min(100, Math.round((item.completed / item.planned) * 100)) : 0;
        return `
            <div class="subject-row">
                <div><strong>${escapeHtml(subject)}</strong><span>${formatMinutes(item.completed)} / ${formatMinutes(item.planned)}</span></div>
                <div class="subject-track"><i style="width:${percent}%"></i></div>
            </div>
        `;
    }).join('');
}

function renderSessionRhythm(sessions) {
    const container = document.getElementById('sessionRhythmList');
    if (!container) return;

    if (!sessions.length) {
        renderEmpty(container, 'Finish a timer to build your rhythm.');
        return;
    }

    const recent = [...sessions].slice(-6).reverse();
    const max = Math.max(1, ...recent.map(session => session.minutes || 0));

    container.innerHTML = recent.map(session => `
        <div class="rhythm-item">
            <span>${escapeHtml(session.subject || session.type)}</span>
            <div class="rhythm-track"><i style="width:${((session.minutes || 0) / max) * 100}%"></i></div>
            <b>${session.minutes || 0}m</b>
        </div>
    `).join('');
}

function renderDashboard() {
    if (!document.getElementById('studyHoursChart')) return;

    const plans = getStudyPlans();
    const sessions = readStore('timerSessions');
    const todos = getTodos();
    const completedPlans = plans.filter(plan => plan.status === 'Completed');
    const totalMinutes = sessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0);

    document.getElementById('totalStudyTime').textContent = formatMinutes(totalMinutes);
    document.getElementById('totalSessions').textContent = sessions.length;
    document.getElementById('totalPlans').textContent = plans.length;
    document.getElementById('completedPlans').textContent = completedPlans.length;

    const emptyDashboard = document.getElementById('emptyDashboard');
    if (emptyDashboard) {
        emptyDashboard.style.display = plans.length || sessions.length || todos.length ? 'none' : 'block';
    }

    const palette = ['#ff4f9a', '#17a2b8', '#ffb020', '#6c5ce7', '#2ecc71', '#ff7675'];
    const sessionMinutesBySubject = chartDataFromObject(sumBy(sessions, 'subject', 'minutes'));
    const plannerStatus = chartDataFromObject(countBy(plans, 'status'));
    const typeCounts = chartDataFromObject(countBy(sessions, 'type'));

    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        return todayKey(date);
    });
    const dailyMinutes = lastSevenDays.map(day => sessions
        .filter(session => session.date === day)
        .reduce((sum, session) => sum + Number(session.minutes || 0), 0)
    );

    const streak = calculateStreak(sessions);
    const today = todayKey();
    const todayMinutes = sessions
        .filter(session => session.date === today)
        .reduce((sum, session) => sum + Number(session.minutes || 0), 0);
    const todayCompletedPlans = plans.filter(plan => {
        if (plan.status !== 'Completed') return false;
        return todayKey(plan.completedAt || plan.date) === today;
    }).length;
    const todayDoneTodos = todos.filter(todo => {
        if (!todo.done) return false;
        return todo.completedAt ? todayKey(todo.completedAt) === today : (!todo.dueDate || todo.dueDate === today);
    }).length;
    const focusScore = Math.min(100, (todayMinutes * 2) + (todayCompletedPlans * 20) + (todayDoneTodos * 10));

    makeChart('studyHoursChart', {
        type: 'bar',
        data: { labels: sessionMinutesBySubject.labels, datasets: [{ label: 'Completed Minutes', data: sessionMinutesBySubject.values, backgroundColor: palette, borderRadius: 12 }] },
        options: { scales: { y: { beginAtZero: true } } }
    });

    makeChart('plannerStatusChart', {
        type: 'doughnut',
        data: { labels: plannerStatus.labels, datasets: [{ data: plannerStatus.values, backgroundColor: palette, borderWidth: 0 }] },
        options: { cutout: '68%' }
    });

    makeChart('dailyFocusChart', {
        type: 'line',
        data: { labels: lastSevenDays, datasets: [{ label: 'Minutes', data: dailyMinutes, borderColor: '#17a2b8', backgroundColor: 'rgba(23,162,184,.18)', tension: 0.38, fill: true, pointBackgroundColor: '#ff4f9a', pointRadius: 5 }] },
        options: { scales: { y: { beginAtZero: true } } }
    });

    makeChart('timerTypeChart', {
        type: 'polarArea',
        data: { labels: typeCounts.labels, datasets: [{ data: typeCounts.values, backgroundColor: ['#ff4f9a', '#17a2b8', '#ffb020'] }] }
    });

    updateFocusScore(focusScore, `${formatMinutes(todayMinutes)} studied today, ${todayCompletedPlans} plan done, ${todayDoneTodos} task done.`);
    updateStreakFlame(streak);
    renderStreakBoard(sessions);
    checkStreakBreak(sessions);
    renderPriorityBars(todos);
    renderDueSoon(todos);
    renderSubjectProgress(plans);
    renderSessionRhythm(sessions);
}
