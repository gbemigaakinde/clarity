# Firestore Database Structure

## Collections

### 1. users
Stores user account information and roles.

```json
{
  "userId": {
    "email": "user@example.com",
    "role": "student",  // or "admin"
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. courses
Stores all course information including lessons.

```json
{
  "courseId": {
    "title": "Web Development Fundamentals",
    "slug": "web-development-fundamentals",
    "description": "Learn the basics of web development including HTML, CSS, and JavaScript",
    "category": "Development",
    "instructor": "John Smith",
    "thumbnail": "https://example.com/image.jpg",
    "price": 49.99,
    "published": true,
    "lessons": [
      {
        "title": "Introduction to HTML",
        "order": 1,
        "videoUrl": "https://www.youtube.com/embed/xxxxx",
        "duration": 15
      },
      {
        "title": "CSS Basics",
        "order": 2,
        "videoUrl": "https://www.youtube.com/embed/yyyyy",
        "duration": 20
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. enrollments
Tracks which users are enrolled in which courses.

```json
{
  "enrollmentId": {
    "userId": "user123",
    "courseId": "course456",
    "enrolledAt": "2024-01-01T00:00:00.000Z",
    "progress": 0,
    "completedLessons": []
  }
}
```

### 4. progress
Tracks individual user progress through courses.

```json
{
  "progressId": {
    "userId": "user123",
    "courseId": "course456",
    "completedLessons": [0, 1, 3],
    "lastAccessedLesson": 3,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Sample Data

Here's sample data you can use to test the system:

### Sample Course 1
```json
{
  "title": "Complete JavaScript Course",
  "slug": "complete-javascript-course",
  "description": "Master JavaScript from beginner to advanced with hands-on projects and real-world examples",
  "category": "Development",
  "instructor": "Sarah Johnson",
  "thumbnail": "https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=800",
  "price": 79.99,
  "published": true,
  "lessons": [
    {
      "title": "JavaScript Basics",
      "order": 1,
      "videoUrl": "https://www.youtube.com/embed/PkZNo7MFNFg",
      "duration": 25
    },
    {
      "title": "Functions and Scope",
      "order": 2,
      "videoUrl": "https://www.youtube.com/embed/N8ap4k_1QEQ",
      "duration": 30
    },
    {
      "title": "Arrays and Objects",
      "order": 3,
      "videoUrl": "https://www.youtube.com/embed/W6NZfCO5SIk",
      "duration": 35
    }
  ]
}
```

### Sample Course 2
```json
{
  "title": "UI/UX Design Fundamentals",
  "slug": "ui-ux-design-fundamentals",
  "description": "Learn the principles of user interface and user experience design to create beautiful, user-friendly applications",
  "category": "Design",
  "instructor": "Michael Chen",
  "thumbnail": "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800",
  "price": 59.99,
  "published": true,
  "lessons": [
    {
      "title": "Introduction to UI/UX",
      "order": 1,
      "videoUrl": "https://www.youtube.com/embed/c9Wg6Cb_YlU",
      "duration": 20
    },
    {
      "title": "Design Principles",
      "order": 2,
      "videoUrl": "https://www.youtube.com/embed/a5KYlHNKQB8",
      "duration": 28
    }
  ]
}
```

### Sample Course 3
```json
{
  "title": "Data Science with Python",
  "slug": "data-science-python",
  "description": "Learn data analysis, visualization, and machine learning using Python and popular libraries",
  "category": "Data Science",
  "instructor": "Dr. Emily Watson",
  "thumbnail": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
  "price": 89.99,
  "published": true,
  "lessons": [
    {
      "title": "Python for Data Science",
      "order": 1,
      "videoUrl": "https://www.youtube.com/embed/LHBE6Q9XlzI",
      "duration": 45
    },
    {
      "title": "Data Analysis with Pandas",
      "order": 2,
      "videoUrl": "https://www.youtube.com/embed/vmEHCJofslg",
      "duration": 50
    }
  ]
}
```
