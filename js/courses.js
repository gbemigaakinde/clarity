import { db } from './firebase-config.js';
import { collection, query, where, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let allCourses = [];

async function loadCourses() {
    const grid = document.getElementById('coursesGrid');
    
    try {
        const coursesRef = collection(db, 'courses');
        let querySnapshot;
        
        try {
            const q = query(coursesRef, where('published', '==', true), orderBy('title'));
            querySnapshot = await getDocs(q);
        } catch (indexError) {
            console.warn('Composite index not found, falling back to simple query:', indexError);
            const q = query(coursesRef, where('published', '==', true));
            querySnapshot = await getDocs(q);
        }
        
        allCourses = [];
        querySnapshot.forEach((doc) => {
            allCourses.push({ id: doc.id, ...doc.data() });
        });
        
        allCourses.sort((a, b) => a.title.localeCompare(b.title));
        
        displayCourses(allCourses);
    } catch (error) {
        console.error('Error loading courses:', error);
        grid.innerHTML = '<p class="loading">Error loading courses.</p>';
    }
}

function displayCourses(courses) {
    const grid = document.getElementById('coursesGrid');
    
    if (courses.length === 0) {
        grid.innerHTML = '<p class="loading">No courses found.</p>';
        return;
    }
    
    grid.innerHTML = '';
    courses.forEach((course) => {
        const courseCard = createCourseCard(course.id, course);
        grid.appendChild(courseCard);
    });
}

function createCourseCard(id, course) {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.onclick = () => window.location.href = `course-detail.html?id=${id}`;
    
    const moduleCount = course.modules ? course.modules.length : 0;
    const lessonCount = course.modules 
        ? course.modules.reduce((sum, mod) => sum + (mod.lessons?.length || 0), 0)
        : 0;
    const totalDuration = course.modules 
        ? course.modules.reduce((sum, mod) => {
            const modDuration = mod.lessons?.reduce((s, l) => s + (l.duration || 0), 0) || 0;
            return sum + modDuration;
        }, 0)
        : 0;
    
    card.innerHTML = `
        <img src="${course.thumbnail || 'https://via.placeholder.com/400x200'}" alt="${course.title}">
        <div class="course-card-content">
            <span class="course-category">${course.category}</span>
            <h3>${course.title}</h3>
            <p>${course.description.substring(0, 120)}...</p>
            <div class="course-meta">
                <span class="course-instructor">
                    <i class="fas fa-user"></i>
                    ${course.instructor}
                </span>
                <span class="course-price">$${course.price}</span>
            </div>
            <div class="course-meta" style="margin-top: 0.5rem; border-top: none; padding-top: 0;">
                <span style="font-size: 0.875rem; color: var(--text-secondary);">
                    <i class="fas fa-layer-group"></i>
                    ${moduleCount} modules
                </span>
                <span style="font-size: 0.875rem; color: var(--text-secondary);">
                    <i class="fas fa-play-circle"></i>
                    ${lessonCount} lessons
                </span>
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">
                <i class="fas fa-clock"></i>
                ${totalDuration} min total
            </div>
        </div>
    `;
    
    return card;
}

function filterCourses() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    const filtered = allCourses.filter(course => {
        const matchesSearch = course.title.toLowerCase().includes(searchTerm) ||
                            course.description.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || course.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    displayCourses(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
    loadCourses();
    
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterCourses);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterCourses);
    }
});