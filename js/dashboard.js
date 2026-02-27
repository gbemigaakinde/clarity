import { auth, db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { requireAuth } from './auth.js';
import { transformImageUrl } from './image-utils.js';

async function initDashboard() {
    await requireAuth();
    setupNav();
    loadProfile();
    loadEnrolledCourses();
}

function setupNav() {
    document.querySelectorAll('.dashboard-nav__item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dashboard-nav__item').forEach(b => b.classList.remove('is-active'));
            document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('is-active'));
            btn.classList.add('is-active');
            const target = btn.dataset.section;
            document.getElementById(target)?.classList.add('is-active');
        });
    });
}

async function loadProfile() {
    const user = auth.currentUser;
    if (!user) return;

    const initial = user.email.charAt(0).toUpperCase();
    const avatarEl = document.getElementById('profileAvatar');
    const emailEl = document.getElementById('profileEmail');
    const roleEl = document.getElementById('profileRole');

    if (avatarEl) avatarEl.textContent = initial;
    if (emailEl) emailEl.textContent = user.email;

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && roleEl) {
            const role = userDoc.data().role || 'student';
            roleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
        }
    } catch {}

    // Welcome section
    const welcomeEl = document.getElementById('welcomeEmail');
    if (welcomeEl) welcomeEl.textContent = user.email.split('@')[0];
}

async function loadEnrolledCourses() {
    const grid = document.getElementById('enrolledCoursesGrid');
    if (!grid) return;

    const user = auth.currentUser;
    if (!user) return;

    grid.innerHTML = `<p class="loading-text" style="grid-column:1/-1">Loading your courses…</p>`;

    try {
        const enrollSnap = await getDocs(
            query(collection(db, 'enrollments'), where('userId', '==', user.uid))
        );

        if (enrollSnap.empty) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <div class="empty-state__icon"><i class="fas fa-book-open"></i></div>
                    <h3 class="empty-state__title">No courses yet</h3>
                    <p class="empty-state__desc">Browse our catalog and enroll in a course to get started.</p>
                    <a href="courses.html" class="btn btn--primary">Browse Courses</a>
                </div>`;

            // Update stat
            const statEl = document.getElementById('statCourses');
            if (statEl) statEl.textContent = '0';
            return;
        }

        const enrollments = [];
        enrollSnap.forEach(d => enrollments.push(d.data()));

        // Stat
        const statEl = document.getElementById('statCourses');
        if (statEl) statEl.textContent = enrollments.length;

        grid.innerHTML = '';

        let completedCount = 0;
        let totalProgressSum = 0;

        for (const enrollment of enrollments) {
            try {
                const courseDoc = await getDoc(doc(db, 'courses', enrollment.courseId));
                if (!courseDoc.exists()) continue;

                const course = { id: courseDoc.id, ...courseDoc.data() };
                const totalLessons = course.modules?.reduce((s, m) => s + (m.lessons?.length || 0), 0) || 1;

                // Get progress
                const progSnap = await getDocs(
                    query(collection(db, 'progress'),
                        where('userId', '==', user.uid),
                        where('courseId', '==', enrollment.courseId))
                );

                let progress = 0;
                if (!progSnap.empty) {
                    const pd = progSnap.docs[0].data();
                    const completed = Object.values(pd.completedLessons || {}).reduce((s, a) => s + a.length, 0);
                    progress = Math.min(100, Math.round((completed / totalLessons) * 100));
                }

                totalProgressSum += progress;
                if (progress >= 100) completedCount++;

                grid.appendChild(buildEnrolledCard(course, progress));
            } catch (err) {
                console.error(err);
            }
        }

        // Completed stat
        const completedEl = document.getElementById('statCompleted');
        if (completedEl) completedEl.textContent = completedCount;

        // Avg progress
        const avgEl = document.getElementById('statAvgProgress');
        if (avgEl) avgEl.textContent = enrollments.length
            ? Math.round(totalProgressSum / enrollments.length) + '%'
            : '0%';

    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p class="loading-text">Error loading your courses.</p>';
    }
}

function buildEnrolledCard(course, progress) {
    const card = document.createElement('a');
    card.className = 'course-card';
    card.href = `lesson.html?courseId=${course.id}`;

    const thumb = transformImageUrl(course.thumbnail || '');

    card.innerHTML = `
        <div class="course-card__thumb">
            <img src="${thumb}" alt="${course.title}"
                 onerror="this.onerror=null;this.src='https://via.placeholder.com/640x360/111118/FFFFFF?text=${encodeURIComponent(course.title)}';this.style.opacity='0.5'">
            <div class="course-card__thumb-overlay"></div>
        </div>
        <div class="course-card__body">
            <span class="badge badge--category">${course.category}</span>
            <h3 class="course-card__title">${course.title}</h3>
            <p class="course-card__desc">${course.description}</p>
            <div style="margin-top:auto;padding-top:var(--s-4)">
                <div class="progress-label" style="margin-bottom:var(--s-2)">
                    <span>Progress</span>
                    <strong style="color:${progress >= 100 ? 'var(--jade-600)' : 'var(--ink-700)'}">${progress}%</strong>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${progress}%"></div>
                </div>
            </div>
            <div style="margin-top:var(--s-4)">
                <span class="btn btn--primary btn--sm btn--full">
                    ${progress > 0 ? '<i class="fas fa-play"></i> Continue' : '<i class="fas fa-play"></i> Start Course'}
                </span>
            </div>
        </div>
    `;
    return card;
}

document.addEventListener('DOMContentLoaded', initDashboard);
