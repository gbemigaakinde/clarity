import { db } from './firebase-config.js';
import { collection, query, where, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { transformImageUrl } from './image-utils.js';

let allCourses = [];

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            revealObserver.unobserve(e.target);
        }
    });
}, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

async function loadCourses() {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    showSkeletons(grid);

    try {
        const ref = collection(db, 'courses');
        let snap;
        try {
            snap = await getDocs(query(ref, where('published', '==', true), orderBy('title')));
        } catch {
            snap = await getDocs(query(ref, where('published', '==', true)));
        }

        allCourses = [];
        snap.forEach(doc => allCourses.push({ id: doc.id, ...doc.data() }));
        allCourses.sort((a, b) => a.title.localeCompare(b.title));

        renderCourses(allCourses, grid);
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p class="loading-text">Error loading courses.</p>';
    }
}

function showSkeletons(grid) {
    grid.innerHTML = Array(6).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-thumb"></div>
            <div class="skeleton-body">
                <div class="skeleton-line skeleton" style="height:12px;width:35%"></div>
                <div class="skeleton-line skeleton" style="height:18px;width:82%;margin-top:8px"></div>
                <div class="skeleton-line skeleton" style="height:14px;width:68%;margin-top:6px"></div>
                <div class="skeleton-line skeleton" style="height:12px;width:50%;margin-top:12px"></div>
            </div>
        </div>
    `).join('');
}

function renderCourses(courses, grid) {
    if (!courses.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-state__icon"><i class="fas fa-search"></i></div>
                <h3 class="empty-state__title">No courses found</h3>
                <p class="empty-state__desc">Try adjusting your search or filter.</p>
            </div>`;
        return;
    }

    grid.innerHTML = '';
    courses.forEach((course, i) => {
        const card = buildCard(course);
        // Only add staggered reveal to first 6 cards
        if (i < 6) {
            card.classList.add('reveal');
            if (i > 0) card.classList.add(`reveal--delay-${Math.min(i, 4)}`);
        }
        grid.appendChild(card);
    });

    // Observe cards AFTER they are in the DOM
    grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

function buildCard(course) {
    const card = document.createElement('a');
    card.className = 'course-card';
    card.href = `course-detail.html?id=${course.id}`;

    const thumb = transformImageUrl(course.thumbnail || '');
    const moduleCount = course.modules?.length || 0;
    const lessonCount = course.modules?.reduce((s, m) => s + (m.lessons?.length || 0), 0) || 0;
    const totalDuration = course.modules?.reduce((s, m) =>
        s + (m.lessons?.reduce((ls, l) => ls + (l.duration || 0), 0) || 0), 0) || 0;

    card.innerHTML = `
        <div class="course-card__thumb">
            <img src="${thumb}" alt="${course.title}"
                 onerror="this.onerror=null;this.src='https://via.placeholder.com/640x360/111118/FFFFFF?text=${encodeURIComponent(course.title)}';this.style.opacity='0.5'">
            <div class="course-card__thumb-overlay"></div>
        </div>
        <div class="course-card__body">
            <span class="badge badge--category course-card__category">${course.category}</span>
            <h3 class="course-card__title">${course.title}</h3>
            <p class="course-card__desc">${course.description}</p>
            <div class="course-card__meta">
                <span class="course-card__meta-item"><i class="fas fa-layer-group"></i> ${moduleCount} modules</span>
                <span class="course-card__meta-item"><i class="fas fa-play-circle"></i> ${lessonCount} lessons</span>
                ${totalDuration ? `<span class="course-card__meta-item"><i class="fas fa-clock"></i> ${totalDuration} min</span>` : ''}
            </div>
            <div class="course-card__footer">
                <span class="course-card__instructor">
                    <i class="fas fa-user-circle" style="color:var(--ink-300)"></i>
                    ${course.instructor}
                </span>
                <span class="course-card__price">$${course.price}</span>
            </div>
        </div>
    `;
    return card;
}

function filterCourses() {
    const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const cat = document.getElementById('categoryFilter')?.value || '';
    const grid = document.getElementById('coursesGrid');

    const filtered = allCourses.filter(c => {
        const matchSearch = !search ||
            c.title.toLowerCase().includes(search) ||
            c.description.toLowerCase().includes(search) ||
            c.instructor?.toLowerCase().includes(search);
        const matchCat = !cat || c.category === cat;
        return matchSearch && matchCat;
    });

    renderCourses(filtered, grid);
}

document.addEventListener('DOMContentLoaded', () => {
    loadCourses();
    document.getElementById('searchInput')?.addEventListener('input', filterCourses);
    document.getElementById('categoryFilter')?.addEventListener('change', filterCourses);
});
