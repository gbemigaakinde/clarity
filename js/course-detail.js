import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { transformImageUrl } from './image-utils.js';

let courseId = null;
let courseData = null;
let isEnrolled = false;

function getCourseId() {
    return new URLSearchParams(window.location.search).get('id');
}

async function init() {
    courseId = getCourseId();
    if (!courseId) { window.location.href = 'courses.html'; return; }

    try {
        const snap = await getDoc(doc(db, 'courses', courseId));
        if (!snap.exists()) { showNotFound(); return; }
        courseData = { id: snap.id, ...snap.data() };

        if (auth.currentUser) await checkEnrollment();
        render();
    } catch (err) {
        console.error(err);
        document.getElementById('courseContent').innerHTML =
            '<div class="container"><p class="loading-text">Error loading course.</p></div>';
    }
}

async function checkEnrollment() {
    try {
        const q = query(
            collection(db, 'enrollments'),
            where('userId', '==', auth.currentUser.uid),
            where('courseId', '==', courseId)
        );
        isEnrolled = !(await getDocs(q)).empty;
    } catch {}
}

function showNotFound() {
    document.getElementById('courseContent').innerHTML =
        '<div class="container" style="padding:4rem 0"><p class="loading-text">Course not found.</p></div>';
}

function render() {
    const content = document.getElementById('courseContent');
    const modules = courseData.modules || [];
    const moduleCount = modules.length;
    const lessonCount = modules.reduce((s, m) => s + (m.lessons?.length || 0), 0);
    const totalDuration = modules.reduce((s, m) =>
        s + (m.lessons?.reduce((ls, l) => ls + (l.duration || 0), 0) || 0), 0);
    const thumb = transformImageUrl(courseData.thumbnail || '');

    document.title = `${courseData.title} — Clarity Academy`;

    // ── Single purchase card — CSS handles positioning at all breakpoints ──
    content.innerHTML = `
        <div class="course-detail-header">
            <div class="container">
                <div class="course-detail-header__inner">

                    <!-- Left: course info -->
                    <div class="course-detail-header__info">
                        <div class="course-detail-header__breadcrumb">
                            <a href="courses.html">Courses</a>
                            <i class="fas fa-chevron-right" style="font-size:10px"></i>
                            <span>${courseData.category}</span>
                        </div>
                        <span class="badge badge--cobalt" style="margin-bottom:var(--s-4);display:inline-flex">${courseData.category}</span>
                        <h1>${courseData.title}</h1>
                        <p class="course-detail-header__desc">${courseData.description}</p>
                        <div class="course-detail-meta">
                            <span class="course-detail-meta__item"><i class="fas fa-user"></i> ${courseData.instructor}</span>
                            <span class="course-detail-meta__item"><i class="fas fa-layer-group"></i> ${moduleCount} modules</span>
                            <span class="course-detail-meta__item"><i class="fas fa-play-circle"></i> ${lessonCount} lessons</span>
                            ${totalDuration ? `<span class="course-detail-meta__item"><i class="fas fa-clock"></i> ${totalDuration} min</span>` : ''}
                        </div>
                    </div>

                    <!-- Right: purchase card (one card, CSS positions it everywhere) -->
                    <div class="course-detail-header__card-wrap">
                        <div class="purchase-card">
                            <div class="purchase-card__thumb">
                                <img src="${thumb}" alt="${courseData.title}"
                                     onerror="this.onerror=null;this.src='https://via.placeholder.com/640x360/111118/FFFFFF?text=${encodeURIComponent(courseData.title)}'">
                            </div>
                            <div class="purchase-card__body">
                                ${buildPurchaseCardBody(lessonCount, totalDuration)}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <div class="course-detail-body">
            <div class="container">
                <div class="course-detail-main">
                    <div class="course-section reveal">
                        <h2>About this course</h2>
                        <p style="color:var(--ink-600);line-height:1.75">${courseData.description}</p>
                    </div>
                    <div class="course-section reveal reveal--delay-1">
                        <h2>Curriculum — ${moduleCount} modules, ${lessonCount} lessons</h2>
                        ${buildCurriculum(modules)}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Wire enroll buttons
    document.querySelectorAll('.js-enroll-btn').forEach(btn => {
        btn.addEventListener('click', handleEnroll);
    });

    // Scroll reveal for content sections
    document.querySelectorAll('.reveal').forEach(el => {
        new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('is-visible');
                }
            });
        }, { threshold: 0.08 }).observe(el);
    });
}

function buildPurchaseCardBody(lessonCount, totalDuration) {
    if (isEnrolled) {
        return `
            <div class="purchase-card__enrolled">
                <i class="fas fa-check-circle"></i> You're enrolled
            </div>
            <a href="lesson.html?courseId=${courseId}" class="btn btn--primary btn--full btn--lg">
                <i class="fas fa-play"></i> Continue Learning
            </a>
            ${buildIncludes(lessonCount, totalDuration)}
        `;
    }

    return `
        <div class="purchase-card__price">$${courseData.price}</div>
        <button class="btn btn--primary btn--full btn--lg js-enroll-btn" id="enrollBtn">
            Enroll Now
        </button>
        <p style="text-align:center;font-size:var(--text-xs);color:var(--ink-400);margin-top:var(--s-3)">
            30-day money-back guarantee
        </p>
        ${buildIncludes(lessonCount, totalDuration)}
    `;
}

function buildIncludes(lessonCount, totalDuration) {
    return `
        <div class="purchase-card__includes">
            <h4>This course includes</h4>
            <div class="purchase-card__include-item"><i class="fas fa-layer-group"></i> ${courseData.modules?.length || 0} structured modules</div>
            <div class="purchase-card__include-item"><i class="fas fa-book-open"></i> ${lessonCount} lessons</div>
            ${totalDuration ? `<div class="purchase-card__include-item"><i class="fas fa-clock"></i> ${totalDuration} min of content</div>` : ''}
            <div class="purchase-card__include-item"><i class="fas fa-mobile-alt"></i> Access on any device</div>
            <div class="purchase-card__include-item"><i class="fas fa-infinity"></i> Lifetime access</div>
        </div>
    `;
}

function buildCurriculum(modules) {
    if (!modules.length) return '<p style="color:var(--ink-400);font-size:var(--text-sm)">No curriculum available yet.</p>';

    return modules.sort((a, b) => a.order - b.order).map(mod => {
        const lessons = (mod.lessons || []).sort((a, b) => a.order - b.order);
        return `
            <div class="curriculum-module">
                <div class="curriculum-module__header">
                    <div class="curriculum-module__title">
                        <i class="fas fa-layer-group" style="color:var(--ink-400)"></i>
                        Module ${mod.order}: ${mod.title}
                    </div>
                    <span class="curriculum-module__count">${lessons.length} lessons</span>
                </div>
                ${lessons.map(lesson => {
                    let icon = 'fa-video';
                    if (lesson.type === 'text') icon = 'fa-file-alt';
                    if (lesson.type === 'mixed') icon = 'fa-layer-group';
                    return `
                        <div class="curriculum-lesson">
                            <i class="fas ${icon} curriculum-lesson__icon"></i>
                            <span class="curriculum-lesson__title">${lesson.order}. ${lesson.title}</span>
                            ${lesson.duration ? `<span class="curriculum-lesson__duration">${lesson.duration} min</span>` : ''}
                            ${isEnrolled
                                ? '<i class="fas fa-play-circle curriculum-lesson__lock" style="color:var(--cobalt-400)"></i>'
                                : '<i class="fas fa-lock curriculum-lesson__lock"></i>'}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

async function handleEnroll() {
    if (!auth.currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const btn = document.getElementById('enrollBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enrolling…'; }

    try {
        await addDoc(collection(db, 'enrollments'), {
            userId: auth.currentUser.uid,
            courseId,
            enrolledAt: new Date(),
            progress: 0,
            completedLessons: []
        });

        const sortedModules = (courseData.modules || []).sort((a, b) => a.order - b.order);
        if (!sortedModules.length) throw new Error('This course has no content yet');
        const firstLesson = (sortedModules[0].lessons || []).sort((a, b) => a.order - b.order)[0];
        if (!firstLesson) throw new Error('No lessons found in first module');

        await addDoc(collection(db, 'progress'), {
            userId: auth.currentUser.uid,
            courseId,
            completedModules: [],
            completedLessons: {},
            currentModule: sortedModules[0].id,
            currentLesson: firstLesson.id,
            lastAccessedAt: new Date(),
            updatedAt: new Date()
        });

        showToast('Enrolled! Redirecting to your course…', 'success');
        setTimeout(() => { window.location.href = `lesson.html?courseId=${courseId}`; }, 1000);
    } catch (err) {
        console.error(err);
        showToast('Could not enroll: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Enroll Now'; }
    }
}

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

onAuthStateChanged(auth, () => { init(); });
