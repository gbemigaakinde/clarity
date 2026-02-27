import { db } from './firebase-config.js';
import { collection, query, where, getDocs, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { transformImageUrl } from './image-utils.js';

async function loadFeaturedCourses() {
    const grid = document.getElementById('featuredCoursesGrid');
    if (!grid) return;

    // Show skeletons
    grid.innerHTML = Array(3).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-thumb"></div>
            <div class="skeleton-body">
                <div class="skeleton-line skeleton skeleton--sm" style="height:12px; width:40%"></div>
                <div class="skeleton-line skeleton" style="height:16px; width:80%; margin-top:8px"></div>
                <div class="skeleton-line skeleton" style="height:16px; width:65%; margin-top:6px"></div>
                <div class="skeleton-line skeleton" style="height:12px; width:55%; margin-top:12px"></div>
            </div>
        </div>
    `).join('');

    try {
        const q = query(
            collection(db, 'courses'),
            where('published', '==', true),
            limit(3)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            grid.innerHTML = '<p class="loading-text">No courses available yet.</p>';
            return;
        }

        grid.innerHTML = '';
        snap.forEach(doc => {
            grid.appendChild(buildCourseCard(doc.id, doc.data()));
        });
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p class="loading-text">Could not load courses.</p>';
    }
}

function buildCourseCard(id, course) {
    const card = document.createElement('a');
    card.className = 'course-card reveal';
    card.href = `course-detail.html?id=${id}`;

    const thumb = transformImageUrl(course.thumbnail || '');
    const moduleCount = course.modules?.length || 0;
    const lessonCount = course.modules?.reduce((s, m) => s + (m.lessons?.length || 0), 0) || 0;

    card.innerHTML = `
        <div class="course-card__thumb">
            <img src="${thumb}" alt="${course.title}"
                 onerror="this.onerror=null;this.src='https://via.placeholder.com/640x360/111118/FFFFFF?text=${encodeURIComponent(course.title)}';this.style.opacity='0.5'">
            <div class="course-card__thumb-overlay"></div>
            <div class="course-card__play">
                <div class="course-card__play-btn"><i class="fas fa-play" style="margin-left:2px"></i></div>
            </div>
        </div>
        <div class="course-card__body">
            <span class="badge badge--category course-card__category">${course.category}</span>
            <h3 class="course-card__title">${course.title}</h3>
            <p class="course-card__desc">${course.description}</p>
            <div class="course-card__meta">
                <span class="course-card__meta-item"><i class="fas fa-layer-group"></i> ${moduleCount} modules</span>
                <span class="course-card__meta-item"><i class="fas fa-play-circle"></i> ${lessonCount} lessons</span>
            </div>
            <div class="course-card__footer">
                <span class="course-card__instructor"><i class="fas fa-user-circle" style="color:var(--ink-300)"></i> ${course.instructor}</span>
                <span class="course-card__price">$${course.price}</span>
            </div>
        </div>
    `;
    return card;
}

document.addEventListener('DOMContentLoaded', loadFeaturedCourses);
