import { auth, db } from './firebase-config.js';
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
import { requireAdmin } from './auth.js';

let allCourses = [];
let currentEditingCourseId = null;
let currentEditingCourseData = null;
let currentEditingModuleId = null;

// Utility function to generate unique IDs
function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        document.getElementById('totalCourses').textContent = coursesSnapshot.size;

        const usersSnapshot = await getDocs(collection(db, 'users'));
        let studentCount = 0;
        usersSnapshot.forEach(doc => {
            if (doc.data().role === 'student') studentCount++;
        });
        document.getElementById('totalStudents').textContent = studentCount;

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

    const moduleCount = course.modules ? course.modules.length : 0;
    const lessonCount = course.modules 
        ? course.modules.reduce((sum, mod) => sum + (mod.lessons?.length || 0), 0)
        : 0;
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
                <i class="fas fa-layer-group"></i> ${moduleCount} modules • 
                <i class="fas fa-play-circle"></i> ${lessonCount} lessons
            </div>
            <div class="course-admin-actions">
                <button class="btn btn-sm btn-primary" onclick="window.adminPanel.editCourse('${course.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-secondary" onclick="window.adminPanel.manageModules('${course.id}')">
                    <i class="fas fa-list"></i> Modules
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
    const modulesModal = document.getElementById('modulesModal');
    const moduleFormModal = document.getElementById('moduleFormModal');
    const lessonFormModal = document.getElementById('lessonFormModal');
    
    const closeBtns = document.querySelectorAll('.close');
    const cancelBtn = document.getElementById('cancelBtn');

    createBtn.addEventListener('click', () => {
        openCourseModal();
    });

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            courseModal.classList.remove('active');
            modulesModal.classList.remove('active');
            moduleFormModal.classList.remove('active');
            lessonFormModal.classList.remove('active');
        });
    });

    cancelBtn.addEventListener('click', () => {
        courseModal.classList.remove('active');
    });

    document.getElementById('cancelModuleBtn').addEventListener('click', () => {
        moduleFormModal.classList.remove('active');
    });

    document.getElementById('cancelLessonBtn').addEventListener('click', () => {
        lessonFormModal.classList.remove('active');
    });

    document.getElementById('courseForm').addEventListener('submit', handleCourseSave);
    document.getElementById('moduleForm').addEventListener('submit', handleModuleSave);
    document.getElementById('lessonForm').addEventListener('submit', handleLessonSave);

    document.getElementById('addModuleBtn').addEventListener('click', () => {
        openModuleFormModal();
    });

    document.getElementById('lessonType').addEventListener('change', (e) => {
        toggleLessonFields(e.target.value);
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
            document.getElementById('courseAccessType').value = course.accessConfig?.type || 'sequential';
            document.getElementById('courseAllowSkip').checked = course.accessConfig?.allowSkip || false;
            document.getElementById('courseId').value = courseId;
        }
    } else {
        modalTitle.textContent = 'Create Course';
        document.getElementById('courseId').value = '';
        document.getElementById('courseAccessType').value = 'sequential';
        document.getElementById('courseAllowSkip').checked = false;
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
        accessConfig: {
            type: document.getElementById('courseAccessType').value,
            allowSkip: document.getElementById('courseAllowSkip').checked
        },
        updatedAt: new Date()
    };

    try {
        if (currentEditingCourseId) {
            await updateDoc(doc(db, 'courses', currentEditingCourseId), courseData);
        } else {
            courseData.createdAt = new Date();
            courseData.modules = [];
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

// Manage modules
async function manageModules(courseId) {
    currentEditingCourseId = courseId;
    
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;

    currentEditingCourseData = course;
    
    document.getElementById('modulesCourseName').textContent = course.title;
    displayModulesList(course.modules || []);
    
    document.getElementById('modulesModal').classList.add('active');
}

function displayModulesList(modules) {
    const modulesList = document.getElementById('modulesList');
    
    if (modules.length === 0) {
        modulesList.innerHTML = '<p class="loading">No modules yet. Add your first module!</p>';
        return;
    }

    const sortedModules = [...modules].sort((a, b) => a.order - b.order);

    modulesList.innerHTML = '';
    sortedModules.forEach((module, moduleIndex) => {
        const moduleItem = document.createElement('div');
        moduleItem.className = 'module-admin-item';
        moduleItem.style.cssText = 'background: #f8f9fa; padding: 1rem; margin-bottom: 1rem; border-radius: 0.5rem; border-left: 4px solid var(--primary-color);';

        const lessonCount = module.lessons?.length || 0;

        moduleItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div>
                    <h4 style="margin: 0;">${module.order}. ${module.title}</h4>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">
                        ${module.description || 'No description'} • ${lessonCount} lessons
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-secondary" onclick="window.adminPanel.manageLessons('${module.id}')">
                        <i class="fas fa-list"></i> Lessons
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="window.adminPanel.editModule('${module.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.adminPanel.deleteModule('${module.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        modulesList.appendChild(moduleItem);
    });
}

// Open module form modal
function openModuleFormModal(moduleId = null) {
    const modal = document.getElementById('moduleFormModal');
    const modalTitle = document.getElementById('moduleModalTitle');
    const form = document.getElementById('moduleForm');

    form.reset();

    if (moduleId) {
        modalTitle.textContent = 'Edit Module';
        const module = currentEditingCourseData.modules.find(m => m.id === moduleId);
        if (module) {
            document.getElementById('moduleTitle').value = module.title;
            document.getElementById('moduleDescription').value = module.description || '';
            document.getElementById('moduleOrder').value = module.order;
            document.getElementById('moduleId').value = moduleId;
        }
    } else {
        modalTitle.textContent = 'Add Module';
        const nextOrder = currentEditingCourseData.modules ? currentEditingCourseData.modules.length + 1 : 1;
        document.getElementById('moduleOrder').value = nextOrder;
        document.getElementById('moduleId').value = '';
    }

    document.getElementById('moduleCourseId').value = currentEditingCourseId;
    modal.classList.add('active');
}

// Handle module save
async function handleModuleSave(e) {
    e.preventDefault();

    const saveBtn = e.target.querySelector('button[type="submit"]');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    const moduleData = {
        title: document.getElementById('moduleTitle').value,
        description: document.getElementById('moduleDescription').value,
        order: parseInt(document.getElementById('moduleOrder').value),
        lessons: []
    };

    const moduleId = document.getElementById('moduleId').value;
    const modules = currentEditingCourseData.modules || [];

    try {
        if (moduleId) {
            const moduleIndex = modules.findIndex(m => m.id === moduleId);
            if (moduleIndex !== -1) {
                modules[moduleIndex] = { ...modules[moduleIndex], ...moduleData };
            } else {
                throw new Error('Module not found');
            }
        } else {
            moduleData.id = generateId('module');
            moduleData.lessons = [];
            modules.push(moduleData);
        }

        await updateDoc(doc(db, 'courses', currentEditingCourseId), {
            modules: modules,
            updatedAt: new Date()
        });

        const courseDoc = await getDoc(doc(db, 'courses', currentEditingCourseId));
        if (!courseDoc.exists()) {
            throw new Error('Course not found after update');
        }
        
        currentEditingCourseData = { id: courseDoc.id, ...courseDoc.data() };

        displayModulesList(currentEditingCourseData.modules);
        document.getElementById('moduleFormModal').classList.remove('active');
        loadCourses();
        alert('Module saved successfully!');
    } catch (error) {
        console.error('Error saving module:', error);
        alert(`Failed to save module: ${error.message}\n\nPlease check:\n- Your internet connection\n- Admin permissions\n- Browser console for details`);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Module';
        }
    }
}

// Edit module
function editModule(moduleId) {
    openModuleFormModal(moduleId);
}

// Delete module
async function deleteModule(moduleId) {
    if (!confirm('Are you sure you want to delete this module and all its lessons?')) {
        return;
    }

    try {
        const modules = currentEditingCourseData.modules || [];
        const moduleIndex = modules.findIndex(m => m.id === moduleId);
        
        if (moduleIndex !== -1) {
            modules.splice(moduleIndex, 1);
            
            modules.forEach((module, index) => {
                module.order = index + 1;
            });

            await updateDoc(doc(db, 'courses', currentEditingCourseId), {
                modules: modules,
                updatedAt: new Date()
            });

            const courseDoc = await getDoc(doc(db, 'courses', currentEditingCourseId));
            currentEditingCourseData = { id: courseDoc.id, ...courseDoc.data() };

            displayModulesList(currentEditingCourseData.modules);
            loadCourses();
            alert('Module deleted successfully!');
        }
    } catch (error) {
        console.error('Error deleting module:', error);
        alert('Error deleting module. Please try again.');
    }
}

// Manage lessons
function manageLessons(moduleId) {
    currentEditingModuleId = moduleId;
    const module = currentEditingCourseData.modules.find(m => m.id === moduleId);
    
    if (!module) return;

    const modal = document.getElementById('lessonFormModal');
    const modulesList = document.getElementById('modulesList');
    
    modulesList.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <button class="btn btn-sm btn-secondary" onclick="window.adminPanel.backToModules()">
                <i class="fas fa-arrow-left"></i> Back to Modules
            </button>
        </div>
        <h4 style="margin-bottom: 1rem;">Lessons in: ${module.title}</h4>
        <button class="btn btn-primary btn-sm" style="margin-bottom: 1rem;" onclick="window.adminPanel.openLessonFormModal()">
            <i class="fas fa-plus"></i> Add Lesson
        </button>
        <div id="lessonsListContainer"></div>
    `;

    displayLessonsList(module.lessons || []);
}

function backToModules() {
    currentEditingModuleId = null;
    displayModulesList(currentEditingCourseData.modules || []);
}

function displayLessonsList(lessons) {
    const container = document.getElementById('lessonsListContainer');
    
    if (!container) return;
    
    if (lessons.length === 0) {
        container.innerHTML = '<p class="loading">No lessons yet. Add your first lesson!</p>';
        return;
    }

    const sortedLessons = [...lessons].sort((a, b) => a.order - b.order);

    container.innerHTML = '';
    sortedLessons.forEach((lesson) => {
        const lessonItem = document.createElement('div');
        lessonItem.className = 'lesson-admin-item';
        lessonItem.style.cssText = 'background: white; padding: 1rem; margin-bottom: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border-color);';
        
        let typeIcon = 'fa-video';
        let typeLabel = 'Video';
        if (lesson.type === 'text') {
            typeIcon = 'fa-file-alt';
            typeLabel = 'Text';
        } else if (lesson.type === 'mixed') {
            typeIcon = 'fa-layer-group';
            typeLabel = 'Mixed';
        }
        
        const durationText = lesson.duration ? `${lesson.duration} min` : 'No duration';
        const accessRule = lesson.accessRule || 'sequential';

        lessonItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0;">${lesson.order}. ${lesson.title}</h4>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">
                        <i class="fas ${typeIcon}"></i> ${typeLabel} • 
                        <i class="fas fa-clock"></i> ${durationText} • 
                        <i class="fas fa-key"></i> ${accessRule}
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-primary" onclick="window.adminPanel.editLesson('${lesson.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.adminPanel.deleteLesson('${lesson.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        container.appendChild(lessonItem);
    });
}

// Open lesson form modal
function openLessonFormModal(lessonId = null) {
    const modal = document.getElementById('lessonFormModal');
    const modalTitle = document.getElementById('lessonModalTitle');
    const form = document.getElementById('lessonForm');

    form.reset();

    const module = currentEditingCourseData.modules.find(m => m.id === currentEditingModuleId);
    if (!module) return;

    if (lessonId) {
        modalTitle.textContent = 'Edit Lesson';
        const lesson = module.lessons.find(l => l.id === lessonId);
        if (lesson) {
            document.getElementById('lessonTitle').value = lesson.title;
            document.getElementById('lessonOrder').value = lesson.order;
            document.getElementById('lessonType').value = lesson.type || 'text';
            document.getElementById('lessonVideoUrl').value = lesson.videoUrl || '';
            document.getElementById('lessonContent').value = lesson.content || '';
            document.getElementById('lessonDuration').value = lesson.duration || '';
            document.getElementById('lessonAccessRule').value = lesson.accessRule || 'sequential';
            document.getElementById('lessonId').value = lessonId;
            
            toggleLessonFields(lesson.type || 'text');
        }
    } else {
        modalTitle.textContent = 'Add Lesson';
        const nextOrder = module.lessons ? module.lessons.length + 1 : 1;
        document.getElementById('lessonOrder').value = nextOrder;
        document.getElementById('lessonId').value = '';
        document.getElementById('lessonType').value = 'text';
        document.getElementById('lessonAccessRule').value = currentEditingCourseData.accessConfig?.type || 'sequential';
        
        toggleLessonFields('text');
    }

    document.getElementById('lessonCourseId').value = currentEditingCourseId;
    document.getElementById('lessonModuleId').value = currentEditingModuleId;
    modal.classList.add('active');
}

// Toggle lesson form fields based on type
function toggleLessonFields(type) {
    const videoUrlGroup = document.getElementById('videoUrlGroup');
    const contentGroup = document.getElementById('contentGroup');
    const videoUrlInput = document.getElementById('lessonVideoUrl');
    const contentInput = document.getElementById('lessonContent');
    
    if (type === 'video') {
        videoUrlGroup.style.display = 'block';
        contentGroup.style.display = 'none';
        videoUrlInput.required = true;
        contentInput.required = false;
    } else if (type === 'text') {
        videoUrlGroup.style.display = 'none';
        contentGroup.style.display = 'block';
        videoUrlInput.required = false;
        contentInput.required = true;
    } else if (type === 'mixed') {
        videoUrlGroup.style.display = 'block';
        contentGroup.style.display = 'block';
        videoUrlInput.required = true;
        contentInput.required = true;
    }
}

// Handle lesson save
async function handleLessonSave(e) {
    e.preventDefault();

    const saveBtn = e.target.querySelector('button[type="submit"]');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    const lessonType = document.getElementById('lessonType').value;
    
    const lessonData = {
        title: document.getElementById('lessonTitle').value,
        order: parseInt(document.getElementById('lessonOrder').value),
        type: lessonType,
        duration: parseInt(document.getElementById('lessonDuration').value) || null,
        accessRule: document.getElementById('lessonAccessRule').value
    };
    
    if (lessonType === 'video' || lessonType === 'mixed') {
        lessonData.videoUrl = document.getElementById('lessonVideoUrl').value;
    }
    
    if (lessonType === 'text' || lessonType === 'mixed') {
        lessonData.content = document.getElementById('lessonContent').value;
    }

    const lessonId = document.getElementById('lessonId').value;
    const modules = [...currentEditingCourseData.modules];
    const moduleIndex = modules.findIndex(m => m.id === currentEditingModuleId);
    
    if (moduleIndex === -1) {
        alert('Error: Module not found');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Lesson';
        }
        return;
    }

    const lessons = modules[moduleIndex].lessons || [];

    try {
        if (lessonId) {
            const lessonIndex = lessons.findIndex(l => l.id === lessonId);
            if (lessonIndex !== -1) {
                lessons[lessonIndex] = { ...lessons[lessonIndex], ...lessonData };
            } else {
                throw new Error('Lesson not found');
            }
        } else {
            lessonData.id = generateId('lesson');
            lessons.push(lessonData);
        }

        modules[moduleIndex].lessons = lessons;

        await updateDoc(doc(db, 'courses', currentEditingCourseId), {
            modules: modules,
            updatedAt: new Date()
        });

        const courseDoc = await getDoc(doc(db, 'courses', currentEditingCourseId));
        if (!courseDoc.exists()) {
            throw new Error('Course not found after update');
        }
        
        currentEditingCourseData = { id: courseDoc.id, ...courseDoc.data() };

        const module = currentEditingCourseData.modules.find(m => m.id === currentEditingModuleId);
        if (!module) {
            throw new Error('Module not found after refresh');
        }
        
        displayLessonsList(module.lessons);
        document.getElementById('lessonFormModal').classList.remove('active');
        loadCourses();
        alert('Lesson saved successfully!');
    } catch (error) {
        console.error('Error saving lesson:', error);
        alert(`Failed to save lesson: ${error.message}\n\nPlease check:\n- Your internet connection\n- Admin permissions\n- Browser console for details`);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Lesson';
        }
    }
}

// Edit lesson
function editLesson(lessonId) {
    openLessonFormModal(lessonId);
}

// Delete lesson
async function deleteLesson(lessonId) {
    if (!confirm('Are you sure you want to delete this lesson?')) {
        return;
    }

    try {
        const modules = [...currentEditingCourseData.modules];
        const moduleIndex = modules.findIndex(m => m.id === currentEditingModuleId);
        
        if (moduleIndex === -1) return;

        const lessons = modules[moduleIndex].lessons || [];
        const lessonIndex = lessons.findIndex(l => l.id === lessonId);
        
        if (lessonIndex !== -1) {
            lessons.splice(lessonIndex, 1);
            
            lessons.forEach((lesson, index) => {
                lesson.order = index + 1;
            });

            modules[moduleIndex].lessons = lessons;

            await updateDoc(doc(db, 'courses', currentEditingCourseId), {
                modules: modules,
                updatedAt: new Date()
            });

            const courseDoc = await getDoc(doc(db, 'courses', currentEditingCourseId));
            currentEditingCourseData = { id: courseDoc.id, ...courseDoc.data() };

            const module = currentEditingCourseData.modules.find(m => m.id === currentEditingModuleId);
            displayLessonsList(module.lessons);
            loadCourses();
            alert('Lesson deleted successfully!');
        }
    } catch (error) {
        console.error('Error deleting lesson:', error);
        alert('Error deleting lesson. Please try again.');
    }
}

// Export functions
window.adminPanel = {
    editCourse,
    deleteCourse,
    manageModules,
    editModule,
    deleteModule,
    manageLessons,
    editLesson,
    deleteLesson,
    openLessonFormModal,
    backToModules
};

// Initialize
document.addEventListener('DOMContentLoaded', initAdmin);