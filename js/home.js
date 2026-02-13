import { db } from './firebase-config.js';
import { collection, query, where, getDocs, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

async function loadFeaturedCourses() {
    try {
        const coursesRef = collection(db, 'courses');
        const q = query(coursesRef, where('published', '==', true), limit(6));
        const querySnapshot = await getDocs(q);
        
        const coursesGrid = document.querySelector('.courses-preview .courses-grid');
        if (!coursesGrid) return;
        
        if (querySnapshot.empty) {
            coursesGrid.innerHTML = '<p class="loading">No published courses available yet.</p>';
            return;
        }
        
        coursesGrid.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const course = doc.data();
            const courseId = doc.id;
            
            const moduleCount = course.modules?.length || 0;
            const lessonCount = course.modules
                ? course.modules.reduce((total, mod) => total + (mod.lessons?.length || 0), 0)
                : 0;
            
            const card = document.createElement('div');
            card.className = 'course-card';
            card.addEventListener('click', () => {
                window.location.href = `course-detail.html?id=${courseId}`;
            });
            
            card.innerHTML = `
                <img src="${course.thumbnail || 'https://via.placeholder.com/400x200'}" alt="${course.title}">
                <div class="course-card-content">
                    <span class="course-category">${course.category || 'General'}</span>
                    <h3>${course.title}</h3>
                    <p>${course.description ? course.description.substring(0, 100) + '...' : ''}</p>
                    <div class="course-meta">
                        <span class="course-instructor">
                            <i class="fas fa-user"></i>
                            ${course.instructor || 'Unknown'}
                        </span>
                        <span class="course-price">$${course.price || '0'}</span>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">
                        <i class="fas fa-layer-group"></i> ${moduleCount} modules • 
                        <i class="fas fa-play-circle"></i> ${lessonCount} lessons
                    </div>
                </div>
            `;
            
            coursesGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading courses:', error);
        const coursesGrid = document.querySelector('.courses-preview .courses-grid');
        if (coursesGrid) {
            coursesGrid.innerHTML = '<p class="loading">Error loading courses. Please refresh the page.</p>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedCourses();
});