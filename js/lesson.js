import { auth, db } from './firebase-config.js';
import {
    doc, getDoc, collection, query, where, getDocs, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ── State ──
let courseId     = null;
let courseData   = null;
let progressData = null;
let currentModuleId = null;
let currentLessonId = null;
let allModules   = [];
let allLessons   = [];   // flat list: { moduleId, ...lesson }

// ── Boot ──
function getCourseId() {
    return new URLSearchParams(window.location.search).get('courseId');
}

async function init() {
    courseId = getCourseId();
    if (!courseId) { window.location.href = 'courses.html'; return; }

    if (!auth.currentUser) {
        window.location.href = `login.html?redirect=lesson.html?courseId=${courseId}`;
        return;
    }

    try {
        // Load course + progress in parallel
        const [courseSnap, progressSnap] = await Promise.all([
            getDoc(doc(db, 'courses', courseId)),
            getDocs(query(
                collection(db, 'progress'),
                where('userId', '==', auth.currentUser.uid),
                where('courseId', '==', courseId)
            ))
        ]);

        if (!courseSnap.exists()) {
            showError('Course not found.');
            return;
        }

        courseData = { id: courseSnap.id, ...courseSnap.data() };
        progressData = progressSnap.empty ? null : { id: progressSnap.docs[0].id, ...progressSnap.docs[0].data() };

        // Check enrollment
        const enrollSnap = await getDocs(query(
            collection(db, 'enrollments'),
            where('userId', '==', auth.currentUser.uid),
            where('courseId', '==', courseId)
        ));

        if (enrollSnap.empty) {
            window.location.href = `course-detail.html?id=${courseId}`;
            return;
        }

        // Build flat lesson list
        allModules = (courseData.modules || []).sort((a, b) => a.order - b.order);
        allModules.forEach(mod => {
            (mod.lessons || []).sort((a, b) => a.order - b.order).forEach(lesson => {
                allLessons.push({ moduleId: mod.id, ...lesson });
            });
        });

        // Determine which lesson to show
        if (progressData?.currentLesson) {
            currentModuleId = progressData.currentModule;
            currentLessonId = progressData.currentLesson;
        } else if (allLessons.length) {
            currentModuleId = allLessons[0].moduleId;
            currentLessonId = allLessons[0].id;
        }

        render();
        setupMobileSidebar();

    } catch (err) {
        console.error(err);
        showError('Error loading lesson: ' + err.message);
    }
}

function showError(msg) {
    document.getElementById('lessonApp').innerHTML = `
        <div style="text-align:center;padding:var(--s-16);color:var(--ink-400)">
            <i class="fas fa-exclamation-circle" style="font-size:2rem;margin-bottom:var(--s-4);display:block;color:var(--ruby-500)"></i>
            <p>${msg}</p>
            <a href="dashboard.html" class="btn btn--secondary" style="margin-top:var(--s-6)">Back to Dashboard</a>
        </div>`;
}

// ── Render ──
function render() {
    const app = document.getElementById('lessonApp');
    app.style.display = 'block';
    app.style.height  = '';
    app.style.alignItems = '';
    app.style.justifyContent = '';

    app.innerHTML = `
        <div class="lesson-layout">
            <aside class="lesson-sidebar" id="lessonSidebar">
                ${buildSidebar()}
            </aside>
            <div class="lesson-main" id="lessonMain">
                <div class="lesson-main__scroll" id="lessonScroll">
                    ${buildLessonContent()}
                </div>
                <nav class="lesson-nav" id="lessonNav">
                    ${buildNav()}
                </nav>
            </div>
        </div>
    `;

    // Show mobile toggle
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) toggle.style.display = '';

    // Wire sidebar lesson clicks
    document.querySelectorAll('.sidebar-lesson:not(.sidebar-lesson--locked)').forEach(el => {
        el.addEventListener('click', () => {
            const modId    = el.dataset.moduleId;
            const lessonId = el.dataset.lessonId;
            navigateTo(modId, lessonId);
        });
    });

    // Wire nav buttons
    document.getElementById('btnPrev')?.addEventListener('click', goToPrev);
    document.getElementById('btnNext')?.addEventListener('click', goToNext);
    document.getElementById('btnComplete')?.addEventListener('click', markComplete);
}

// ── Sidebar ──
function buildSidebar() {
    const completedLessons = progressData?.completedLessons || {};
    const totalLessons     = allLessons.length;
    const doneCount        = Object.values(completedLessons).flat().length;
    const pct              = totalLessons ? Math.round((doneCount / totalLessons) * 100) : 0;

    const modulesHtml = allModules.map(mod => {
        const lessons = (mod.lessons || []).sort((a, b) => a.order - b.order);
        const modDone = completedLessons[mod.id] || [];

        const lessonsHtml = lessons.map(lesson => {
            const isActive    = lesson.id === currentLessonId;
            const isCompleted = modDone.includes(lesson.id);
            const isLocked    = isLessonLocked(mod, lesson, completedLessons);

            let cls = 'sidebar-lesson';
            if (isActive)    cls += ' sidebar-lesson--active';
            if (isCompleted) cls += ' sidebar-lesson--completed';
            if (isLocked)    cls += ' sidebar-lesson--locked';

            const checkIcon = isActive
                ? '<i class="fas fa-play" style="font-size:8px"></i>'
                : isCompleted
                    ? '<i class="fas fa-check" style="font-size:9px"></i>'
                    : '';

            const typeIcon = lesson.type === 'video' ? 'fa-video'
                           : lesson.type === 'text'  ? 'fa-file-alt'
                           : 'fa-layer-group';

            return `
                <div class="${cls}"
                     data-module-id="${mod.id}"
                     data-lesson-id="${lesson.id}"
                     role="button" tabindex="${isLocked ? -1 : 0}">
                    <div class="sidebar-lesson__check">${checkIcon}</div>
                    <div class="sidebar-lesson__text">
                        <span class="sidebar-lesson__title">${lesson.title}</span>
                        <span class="sidebar-lesson__meta">
                            <i class="fas ${typeIcon}"></i>
                            ${lesson.duration ? lesson.duration + ' min' : lesson.type || 'lesson'}
                        </span>
                    </div>
                    ${isLocked ? '<i class="fas fa-lock sidebar-lesson__lock"></i>' : ''}
                </div>`;
        }).join('');

        const modDoneCount  = modDone.length;
        const modTotalCount = lessons.length;

        return `
            <div class="sidebar-module">
                <div class="sidebar-module__header">
                    <span class="sidebar-module__name">
                        <i class="fas fa-layer-group"></i>
                        Module ${mod.order}
                    </span>
                    <span class="sidebar-module__count">${modDoneCount}/${modTotalCount}</span>
                </div>
                ${lessonsHtml}
            </div>`;
    }).join('');

    return `
        <div class="lesson-sidebar__header">
            <a href="course-detail.html?id=${courseId}" class="lesson-sidebar__course-name">
                ← Back to Course
            </a>
            <div class="lesson-sidebar__title">${courseData.title}</div>
            <div class="lesson-sidebar__progress">
                <div class="progress-label">
                    <span>Progress</span>
                    <strong>${pct}%</strong>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${pct}%"></div>
                </div>
            </div>
        </div>
        <div class="lesson-sidebar__scroll">
            ${modulesHtml}
        </div>`;
}

// ── Lesson content ──
function buildLessonContent() {
    const mod    = allModules.find(m => m.id === currentModuleId);
    const lesson = allLessons.find(l => l.id === currentLessonId);

    if (!lesson || !mod) {
        return `<div class="lesson-locked">
                    <div class="lesson-locked__icon"><i class="fas fa-book-open"></i></div>
                    <h2>No lessons found</h2>
                    <p>This course doesn't have any lessons yet.</p>
                </div>`;
    }

    const completedLessons = progressData?.completedLessons || {};
    const isCompleted = (completedLessons[currentModuleId] || []).includes(currentLessonId);

    const completionBanner = isCompleted ? `
        <div class="completion-banner">
            <div class="completion-banner__icon"><i class="fas fa-check"></i></div>
            <div class="completion-banner__text">
                <h3>Lesson completed!</h3>
                <p>Great work. Keep going to finish the course.</p>
            </div>
        </div>` : '';

    const headerHtml = `
        <div class="lesson-header">
            <div class="lesson-header__breadcrumb">
                Module ${mod.order}: <span>${mod.title}</span>
            </div>
            <h1>${lesson.title}</h1>
            <div class="lesson-header__meta">
                ${lesson.duration ? `<span class="lesson-header__meta-item"><i class="fas fa-clock"></i> ${lesson.duration} min</span>` : ''}
                <span class="lesson-header__meta-item">
                    <i class="fas ${lesson.type === 'video' ? 'fa-video' : lesson.type === 'text' ? 'fa-file-alt' : 'fa-layer-group'}"></i>
                    ${lesson.type || 'Lesson'}
                </span>
                <span class="lesson-header__meta-item">
                    <i class="fas fa-layer-group"></i> ${mod.title}
                </span>
            </div>
        </div>`;

    let videoHtml = '';
    let textHtml  = '';

    if ((lesson.type === 'video' || lesson.type === 'mixed') && lesson.videoUrl) {
        const embed = buildVideoEmbed(lesson.videoUrl);
        videoHtml = `
            <div class="lesson-video">
                <div class="lesson-video__container">
                    ${embed}
                </div>
            </div>`;
    }

    if ((lesson.type === 'text' || lesson.type === 'mixed') && lesson.content) {
        textHtml = `
            <div class="lesson-text">
                ${lesson.content}
            </div>`;
    }

    if (!videoHtml && !textHtml) {
        textHtml = `
            <div class="lesson-text">
                <p style="color:var(--ink-400)">This lesson has no content yet.</p>
            </div>`;
    }

    return completionBanner + headerHtml + videoHtml + textHtml;
}

function buildVideoEmbed(url) {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        return `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen></iframe>`;
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
        return `<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" frameborder="0"
                    allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }

    // Raw video file
    if (url.match(/\.(mp4|webm|ogg)$/i)) {
        return `<video controls><source src="${url}"></video>`;
    }

    // Fallback: generic iframe
    return `<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`;
}

// ── Nav footer ──
function buildNav() {
    const idx  = allLessons.findIndex(l => l.id === currentLessonId);
    const prev = idx > 0 ? allLessons[idx - 1] : null;
    const next = idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

    const completedLessons = progressData?.completedLessons || {};
    const isCompleted = (completedLessons[currentModuleId] || []).includes(currentLessonId);

    return `
        <button class="btn btn--secondary" id="btnPrev" ${prev ? '' : 'disabled'}>
            <i class="fas fa-arrow-left"></i> Previous
        </button>

        <div class="lesson-nav__info">
            Lesson ${idx + 1} of ${allLessons.length}
        </div>

        <div style="display:flex;gap:var(--s-3);align-items:center">
            ${!isCompleted ? `
                <button class="btn btn--success" id="btnComplete">
                    <i class="fas fa-check"></i> Mark Complete
                </button>` : ''}
            <button class="btn btn--primary" id="btnNext" ${next ? '' : 'disabled'}>
                Next <i class="fas fa-arrow-right"></i>
            </button>
        </div>`;
}

// ── Navigation ──
function navigateTo(moduleId, lessonId) {
    currentModuleId = moduleId;
    currentLessonId = lessonId;

    // Update progress pointer in Firestore (non-blocking)
    saveCurrentPosition();

    // Re-render content and nav only (sidebar updates active state)
    document.getElementById('lessonScroll').innerHTML = buildLessonContent();
    document.getElementById('lessonNav').innerHTML    = buildNav();

    // Update sidebar active states
    document.querySelectorAll('.sidebar-lesson').forEach(el => {
        el.classList.toggle('sidebar-lesson--active', el.dataset.lessonId === lessonId);
    });

    // Re-wire buttons
    document.getElementById('btnPrev')?.addEventListener('click', goToPrev);
    document.getElementById('btnNext')?.addEventListener('click', goToNext);
    document.getElementById('btnComplete')?.addEventListener('click', markComplete);

    // Scroll lesson area to top
    document.getElementById('lessonScroll')?.scrollTo({ top: 0, behavior: 'smooth' });

    // Close mobile sidebar if open
    closeMobileSidebar();
}

function goToPrev() {
    const idx = allLessons.findIndex(l => l.id === currentLessonId);
    if (idx > 0) {
        const prev = allLessons[idx - 1];
        navigateTo(prev.moduleId, prev.id);
    }
}

function goToNext() {
    const idx = allLessons.findIndex(l => l.id === currentLessonId);
    if (idx < allLessons.length - 1) {
        const next = allLessons[idx + 1];
        navigateTo(next.moduleId, next.id);
    }
}

// ── Completion ──
async function markComplete() {
    const btn = document.getElementById('btnComplete');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    try {
        // Update local state
        if (!progressData) {
            progressData = {
                completedLessons: {},
                completedModules: [],
                currentModule: currentModuleId,
                currentLesson: currentLessonId
            };
        }

        if (!progressData.completedLessons[currentModuleId]) {
            progressData.completedLessons[currentModuleId] = [];
        }

        if (!progressData.completedLessons[currentModuleId].includes(currentLessonId)) {
            progressData.completedLessons[currentModuleId].push(currentLessonId);
        }

        // Check if whole module is complete
        const mod = allModules.find(m => m.id === currentModuleId);
        const modLessonIds = (mod?.lessons || []).map(l => l.id);
        const doneLessons  = progressData.completedLessons[currentModuleId] || [];
        const moduleComplete = modLessonIds.every(id => doneLessons.includes(id));

        if (moduleComplete && !progressData.completedModules.includes(currentModuleId)) {
            progressData.completedModules.push(currentModuleId);
        }

        // Save to Firestore
        await saveProgress();

        // Show completion banner and refresh nav
        document.getElementById('lessonScroll').innerHTML = buildLessonContent();
        document.getElementById('lessonNav').innerHTML    = buildNav();

        // Re-wire buttons
        document.getElementById('btnPrev')?.addEventListener('click', goToPrev);
        document.getElementById('btnNext')?.addEventListener('click', goToNext);
        document.getElementById('btnComplete')?.addEventListener('click', markComplete);

        // Update sidebar checkmarks
        updateSidebarLesson(currentModuleId, currentLessonId);

        // Auto-advance to next after short delay
        const idx = allLessons.findIndex(l => l.id === currentLessonId);
        if (idx < allLessons.length - 1) {
            setTimeout(() => {
                const next = allLessons[idx + 1];
                navigateTo(next.moduleId, next.id);
            }, 1200);
        }

    } catch (err) {
        console.error(err);
        showToast('Could not save progress: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Mark Complete'; }
    }
}

function updateSidebarLesson(moduleId, lessonId) {
    const el = document.querySelector(`.sidebar-lesson[data-lesson-id="${lessonId}"]`);
    if (!el) return;
    el.classList.add('sidebar-lesson--completed');
    const check = el.querySelector('.sidebar-lesson__check');
    if (check) check.innerHTML = '<i class="fas fa-check" style="font-size:9px"></i>';
}

// ── Progress helpers ──
async function saveProgress() {
    if (!auth.currentUser || !progressData) return;

    const totalLessons = allLessons.length;
    const doneCount    = Object.values(progressData.completedLessons).flat().length;
    const progress     = totalLessons ? Math.round((doneCount / totalLessons) * 100) : 0;

    const update = {
        completedLessons: progressData.completedLessons,
        completedModules: progressData.completedModules,
        currentModule:    currentModuleId,
        currentLesson:    currentLessonId,
        lastAccessedAt:   new Date(),
        updatedAt:        new Date(),
        progress
    };

    if (progressData.id) {
        await updateDoc(doc(db, 'progress', progressData.id), update);
    }

    // Also update enrollment progress field
    const enSnap = await getDocs(query(
        collection(db, 'enrollments'),
        where('userId', '==', auth.currentUser.uid),
        where('courseId', '==', courseId)
    ));
    if (!enSnap.empty) {
        await updateDoc(doc(db, 'enrollments', enSnap.docs[0].id), { progress });
    }
}

async function saveCurrentPosition() {
    if (!auth.currentUser || !progressData?.id) return;
    try {
        await updateDoc(doc(db, 'progress', progressData.id), {
            currentModule: currentModuleId,
            currentLesson: currentLessonId,
            lastAccessedAt: new Date()
        });
    } catch {}
}

// ── Access rules ──
function isLessonLocked(mod, lesson, completedLessons) {
    const accessType = courseData?.accessConfig?.type || 'sequential';
    const allowSkip  = courseData?.accessConfig?.allowSkip || false;

    if (accessType === 'free' || allowSkip) return false;

    // Sequential: each lesson requires the previous to be complete
    const lessons   = (mod.lessons || []).sort((a, b) => a.order - b.order);
    const lessonIdx = lessons.findIndex(l => l.id === lesson.id);

    if (lessonIdx === 0) {
        // First lesson in module — check if previous module is complete
        const modIdx = allModules.findIndex(m => m.id === mod.id);
        if (modIdx === 0) return false;  // First module, first lesson — always unlocked

        const prevMod      = allModules[modIdx - 1];
        const prevModDone  = completedLessons[prevMod.id] || [];
        const prevModTotal = (prevMod.lessons || []).map(l => l.id);
        return !prevModTotal.every(id => prevModDone.includes(id));
    }

    // Not the first lesson — check that the previous lesson is done
    const prevLesson = lessons[lessonIdx - 1];
    const modDone    = completedLessons[mod.id] || [];
    return !modDone.includes(prevLesson.id);
}

// ── Mobile sidebar ──
function setupMobileSidebar() {
    const toggle  = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');

    toggle?.addEventListener('click', () => {
        document.getElementById('lessonSidebar')?.classList.toggle('is-open');
        overlay?.classList.toggle('is-open');
    });

    overlay?.addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
    document.getElementById('lessonSidebar')?.classList.remove('is-open');
    document.getElementById('sidebarOverlay')?.classList.remove('is-open');
}

// ── Toast ──
function showToast(msg, type = 'info') {
    let region = document.querySelector('.toast-region');
    if (!region) {
        region = document.createElement('div');
        region.className = 'toast-region';
        document.body.appendChild(region);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${msg}`;
    region.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast--out'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// ── Start ──
onAuthStateChanged(auth, user => {
    if (user) {
        init();
    } else {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    }
});
