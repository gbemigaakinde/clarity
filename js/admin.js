import { auth, db } from '../js/firebase-config.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    addDoc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    orderBy 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { requireAdmin } from '../js/auth.js';

let allCourses = [];
let currentEditingCourseId = null;
let currentEditingCourseData = null;

// Initialize admin dashboard
async function initAdmin() {
    const hasAccess = await requireAdmin();
    if (!hasAccess) return;

    loadStats();
    loadCourses();
    setupModals();
}

// Load statistics
async function loadStats() {
    try {
        // Count courses
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        document.getElementById('totalCourses').textContent = coursesSnapshot.size;

        // Count students
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let studentCount = 0;
        usersSnapshot.forEach(doc => {
            if (doc.data().role === 'student') studentCount++;
        });
        document.getElementById('totalStudents').textContent = studentCount;

        // Count enrollments
        const enrollmentsSnapshot = await getDocs(collection(db, 'enrollments'));
        document.getElementById('totalEnrollments').textContent = enrollmentsSnapshot.size;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load all courses
async function loadCourses() {
    const grid = document.getElementById('adminCoursesGrid');
    
    try {
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        
        allCourses = [];
        coursesSnapshot.forEach(doc => {
            allCourses.push({ id: doc.id, ...doc.data() });
        });

        if (allCourses.length === 0) {
            grid.innerHTML = '<p class="loading">No courses yet. Create your first course!</p>';
            return;
        }

        displayCourses(allCourses);
    } catch (error) {
        console.error('Error loading courses:', error);
        grid.innerHTML = '<p class="loading">Error loading courses.</p>';
    }
}

function displayCourses(courses) {
    const grid = document.getElementById('adminCoursesGrid');
    grid.innerHTML = '';

    courses.forEach(course => {
        const card = createAdminCourseCard(course);
        grid.appendChild(card);
    });
}

function createAdminCourseCard(course) {
    const card = document.createElement('div');
    card.className = 'course-card course-admin-card';

    const lessonCount = course.lessons ? course.lessons.length : 0;
    const status = course.published ? 'Published' : 'Draft';
    const statusColor = course.published ? 'var(--success-color)' : 'var(--text-secondary)';

    card.innerHTML = `
        <img src="${course.thumbnail || 'https://via.placeholder.com/400x200'}" alt="${course.title}">
        <div class="course-card-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span class="course-category">${course.category}</span>
                <span style="color: ${statusColor}; font-size: 0.875rem; font-weight: 600;">
                    <i class="fas fa-circle" style="font-size: 0.5rem;"></i> ${status}
                </span>
            </div>
            <h3>${course.title}</h3>
            <p>${course.description.substring(0, 100)}...</p>
            <div class="course-meta">
                <span class="course-instructor">
                    <i class="fas fa-user"></i>
                    ${course.instructor}
                </span>
                <span class="course-price">$${course.price}</span>
            </div>
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color); font-size: 0.875rem; color: var(--text-secondary);">
                <i class="fas fa-play-circle"></i> ${lessonCount} lessons
            </div>
            <div class="course-admin-actions">
                <button class="btn btn-sm btn-primary" onclick="window.adminPanel.editCourse('${course.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-secondary" onclick="window.adminPanel.manageLessons('${course.id}')">
                    <i class="fas fa-list"></i> Lessons
                </button>
                <button class="btn btn-sm btn-danger" onclick="window.adminPanel.deleteCourse('${course.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;

    return card;
}

// Modal setup
function setupModals() {
    const createBtn = document.getElementById('createCourseBtn');
    const courseModal = document.getElementById('courseModal');
    const lessonsModal = document.getElementById('lessonsModal');
    const lessonFormModal = document.getElementById('lessonFormModal');
    
    const closeBtns = document.querySelectorAll('.close');
    const cancelBtn = document.getElementById('cancelBtn');

    // Create course button
    createBtn.addEventListener('click', () => {
        openCourseModal();
    });

    // Close buttons
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            courseModal.classList.remove('active');
            lessonsModal.classList.remove('active');
            lessonFormModal.classList.remove('active');
        });
    });

    cancelBtn.addEventListener('click', () => {
        courseModal.classList.remove('active');
    });

    // Cancel lesson button
    document.getElementById('cancelLessonBtn').addEventListener('click', () => {
        lessonFormModal.classList.remove('active');
    });

    // Course form submit
    document.getElementById('courseForm').addEventListener('submit', handleCourseSave);

    // Lesson form submit
    document.getElementById('lessonForm').addEventListener('submit', handleLessonSave);

    // Add lesson button
    document.getElementById('addLessonBtn').addEventListener('click', () => {
        openLessonFormModal();
    });
}

// Open course modal
function openCourseModal(courseId = null) {
    const modal = document.getElementById('courseModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('courseForm');

    form.reset();
    currentEditingCourseId = courseId;

    if (courseId) {
        // Edit mode
        modalTitle.textContent = 'Edit Course';
        const course = allCourses.find(c => c.id === courseId);
        if (course) {
            document.getElementById('courseTitle').value = course.title;
            document.getElementById('courseSlug').value = course.slug;
            document.getElementById('courseDescription').value = course.description;
            document.getElementById('courseCategory').value = course.category;
            document.getElementById('courseInstructor').value = course.instructor;
            document.getElementById('courseThumbnail').value = course.thumbnail;
            document.getElementById('coursePrice').value = course.price;
            document.getElementById('coursePublished').checked = course.published;
            document.getElementById('courseId').value = courseId;
        }
    } else {
        // Create mode
        modalTitle.textContent = 'Create Course';
        document.getElementById('courseId').value = '';
    }

    modal.classList.add('active');
}

// Handle course save
async function handleCourseSave(e) {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveCourseBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const courseData = {
        title: document.getElementById('courseTitle').value,
        slug: document.getElementById('courseSlug').value,
        description: document.getElementById('courseDescription').value,
        category: document.getElementById('courseCategory').value,
        instructor: document.getElementById('courseInstructor').value,
        thumbnail: document.getElementById('courseThumbnail').value,
        price: parseFloat(document.getElementById('coursePrice').value),
        published: document.getElementById('coursePublished').checked,
        updatedAt: new Date()
    };

    try {
        if (currentEditingCourseId) {
            // Update existing course
            await updateDoc(doc(db, 'courses', currentEditingCourseId), courseData);
        } else {
            // Create new course
            courseData.createdAt = new Date();
            courseData.lessons = [];
            await addDoc(collection(db, 'courses'), courseData);
        }

        document.getElementById('courseModal').classList.remove('active');
        loadCourses();
        loadStats();
        alert('Course saved successfully!');
    } catch (error) {
        console.error('Error saving course:', error);
        alert('Error saving course. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Course';
    }
}

// Edit course
function editCourse(courseId) {
    openCourseModal(courseId);
}

// Delete course
async function deleteCourse(courseId) {
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'courses', courseId));
        
        // Also delete related enrollments and progress
        const enrollmentsQuery = query(collection(db, 'enrollments'), where('courseId', '==', courseId));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        enrollmentsSnapshot.forEach(async (enrollDoc) => {
            await deleteDoc(doc(db, 'enrollments', enrollDoc.id));
        });

        const progressQuery = query(collection(db, 'progress'), where('courseId', '==', courseId));
        const progressSnapshot = await getDocs(progressQuery);
        progressSnapshot.forEach(async (progDoc) => {
            await deleteDoc(doc(db, 'progress', progDoc.id));
        });

        loadCourses();
        loadStats();
        alert('Course deleted successfully!');
    } catch (error) {
        console.error('Error deleting course:', error);
        alert('Error deleting course. Please try again.');
    }
}

// Manage lessons
async function manageLessons(courseId) {
    currentEditingCourseId = courseId;
    
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;

    currentEditingCourseData = course;
    
    document.getElementById('lessonsCourseName').textContent = course.title;
    displayLessonsList(course.lessons || []);
    
    document.getElementById('lessonsModal').classList.add('active');
}

function displayLessonsList(lessons) {
    const lessonsList = document.getElementById('lessonsList');
    
    if (lessons.length === 0) {
        lessonsList.innerHTML = '<p class="loading">No lessons yet. Add your first lesson!</p>';
        return;
    }

    // Sort lessons by order
    const sortedLessons = [...lessons].sort((a, b) => a.order - b.order);

    lessonsList.innerHTML = '';
    sortedLessons.forEach((lesson, index) => {
        const lessonItem = document.createElement('div');
        lessonItem.className = 'lesson-admin-item';

        lessonItem.innerHTML = `
            <div class="lesson-admin-info">
                <h4>${lesson.order}. ${lesson.title}</h4>
                <p><i class="fas fa-clock"></i> ${lesson.duration} minutes | <i class="fas fa-link"></i> ${lesson.videoUrl.substring(0, 50)}...</p>
            </div>
            <div class="lesson-admin-actions">
                <button class="btn btn-sm btn-primary" onclick="window.adminPanel.editLesson(${index})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="window.adminPanel.deleteLesson(${index})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        lessonsList.appendChild(lessonItem);
    });
}

// Open lesson form modal
function openLessonFormModal(lessonIndex = null) {
    const modal = document.getElementById('lessonFormModal');
    const modalTitle = document.getElementById('lessonModalTitle');
    const form = document.getElementById('lessonForm');

    form.reset();

    if (lessonIndex !== null) {
        // Edit mode
        modalTitle.textContent = 'Edit Lesson';
        const lesson = currentEditingCourseData.lessons[lessonIndex];
        document.getElementById('lessonTitle').value = lesson.title;
        document.getElementById('lessonOrder').value = lesson.order;
        document.getElementById('lessonVideoUrl').value = lesson.videoUrl;
        document.getElementById('lessonDuration').value = lesson.duration;
        document.getElementById('lessonId').value = lessonIndex;
    } else {
        // Create mode
        modalTitle.textContent = 'Add Lesson';
        const nextOrder = currentEditingCourseData.lessons ? currentEditingCourseData.lessons.length + 1 : 1;
        document.getElementById('lessonOrder').value = nextOrder;
        document.getElementById('lessonId').value = '';
    }

    document.getElementById('lessonCourseId').value = currentEditingCourseId;
    modal.classList.add('active');
}

// Handle lesson save
async function handleLessonSave(e) {
    e.preventDefault();

    const lessonData = {
        title: document.getElementById('lessonTitle').value,
        order: parseInt(document.getElementById('lessonOrder').value),
        videoUrl: document.getElementById('lessonVideoUrl').value,
        duration: parseInt(document.getElementById('lessonDuration').value)
    };

    const lessonIndex = document.getElementById('lessonId').value;
    const lessons = currentEditingCourseData.lessons || [];

    try {
        if (lessonIndex !== '') {
            // Update existing lesson
            lessons[parseInt(lessonIndex)] = lessonData;
        } else {
            // Add new lesson
            lessons.push(lessonData);
        }

        // Update course with new lessons array
        await updateDoc(doc(db, 'courses', currentEditingCourseId), {
            lessons: lessons,
            updatedAt: new Date()
        });

        // Refresh course data
        const courseDoc = await getDoc(doc(db, 'courses', currentEditingCourseId));
        currentEditingCourseData = { id: courseDoc.id, ...courseDoc.data() };

        displayLessonsList(currentEditingCourseData.lessons);
        document.getElementById('lessonFormModal').classList.remove('active');
        loadCourses();
        alert('Lesson saved successfully!');
    } catch (error) {
        console.error('Error saving lesson:', error);
        alert('Error saving lesson. Please try again.');
    }
}

// Edit lesson
function editLesson(lessonIndex) {
    openLessonFormModal(lessonIndex);
}

// Delete lesson
async function deleteLesson(lessonIndex) {
    if (!confirm('Are you sure you want to delete this lesson?')) {
        return;
    }

    try {
        const lessons = currentEditingCourseData.lessons || [];
        lessons.splice(lessonIndex, 1);

        // Reorder remaining lessons
        lessons.forEach((lesson, index) => {
            lesson.order = index + 1;
        });

        await updateDoc(doc(db, 'courses', currentEditingCourseId), {
            lessons: lessons,
            updatedAt: new Date()
        });

        // Refresh course data
        const courseDoc = await getDoc(doc(db, 'courses', currentEditingCourseId));
        currentEditingCourseData = { id: courseDoc.id, ...courseDoc.data() };

        displayLessonsList(currentEditingCourseData.lessons);
        loadCourses();
        alert('Lesson deleted successfully!');
    } catch (error) {
        console.error('Error deleting lesson:', error);
        alert('Error deleting lesson. Please try again.');
    }
}

// Export functions to window for inline onclick handlers
window.adminPanel = {
    editCourse,
    deleteCourse,
    manageLessons,
    editLesson,
    deleteLesson
};

// Initialize
document.addEventListener('DOMContentLoaded', initAdmin);
