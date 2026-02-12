import { db } from './firebase-config.js';
import { collection, query, where, getDocs, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Load featured courses
async function loadFeaturedCourses() {
    const grid = document.getElementById('featuredCoursesGrid');
    
    try {
        const coursesRef = collection(db, 'courses');
        const q = query(coursesRef, where('published', '==', true), limit(3));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            grid.innerHTML = '<p class="loading">No courses available yet.</p>';
            return;
        }

        grid.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const course = doc.data();
            const courseCard = createCourseCard(doc.id, course);
            grid.appendChild(courseCard);
        });
    } catch (error) {
        console.error('Error loading courses:', error);
        grid.innerHTML = '<p class="loading">Error loading courses.</p>';
    }
}

function createCourseCard(id, course) {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.onclick = () => window.location.href = `course-detail.html?id=${id}`;

    card.innerHTML = `
        <img src="${course.thumbnail || 'https://via.placeholder.com/400x200'}" alt="${course.title}">
        <div class="course-card-content">
            <span class="course-category">${course.category}</span>
            <h3>${course.title}</h3>
            <p>${course.description.substring(0, 100)}...</p>
            <div class="course-meta">
                <span class="course-instructor">
                    <i class="fas fa-user"></i>
                    ${course.instructor}
                </span>
                <span class="course-price">$${course.price}</span>
            </div>
        </div>
    `;

    return card;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedCourses();
});
