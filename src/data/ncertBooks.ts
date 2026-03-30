export type NCERTChapter = {
    id: string;
    title: string;
    pdfFile?: string; // Explicit mapping to the PDF filename
}

export type NCERTBook = {
    id: string;
    title: string;
    bookClass: string;
    subject: string;
    code: string; // The URL code used by NCERT site
    chapters?: NCERTChapter[];
    totalChapters?: number;
    basePath?: string; // The directory structure under /public/books/
}

export const ncertBooksData: NCERTBook[] = [
    // Class 11
    {
        id: 'ncert-bio-11', title: 'Biology', bookClass: '11', subject: 'Biology', code: 'kebo1',
        totalChapters: 19,
        basePath: '11/Biology',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
            { id: 'ch2', title: 'Chapter 2', pdfFile: 'Chapter 2.pdf' },
            { id: 'ch3', title: 'Chapter 3', pdfFile: 'Chapter 3.pdf' },
            { id: 'ch4', title: 'Chapter 4', pdfFile: 'Chapter 4.pdf' },
            { id: 'ch5', title: 'Chapter 5', pdfFile: 'Chapter 5.pdf' },
            { id: 'ch6', title: 'Chapter 6', pdfFile: 'Chapter 6.pdf' },
            { id: 'ch7', title: 'Chapter 7', pdfFile: 'Chapter 7.pdf' },
            { id: 'ch8', title: 'Chapter 8', pdfFile: 'Chapter 8.pdf' },
            { id: 'ch9', title: 'Chapter 9', pdfFile: 'Chapter 9.pdf' },
            { id: 'ch10', title: 'Chapter 10', pdfFile: 'Chapter 10.pdf' },
            { id: 'ch11', title: 'Chapter 11', pdfFile: 'Chapter 11.pdf' },
            { id: 'ch12', title: 'Chapter 12', pdfFile: 'Chapter 12.pdf' },
            { id: 'ch13', title: 'Chapter 13', pdfFile: 'Chapter 13.pdf' },
            { id: 'ch14', title: 'Chapter 14', pdfFile: 'Chapter 14.pdf' },
            { id: 'ch15', title: 'Chapter 15', pdfFile: 'Chapter 15.pdf' },
            { id: 'ch16', title: 'Chapter 16', pdfFile: 'Chapter 16.pdf' },
            { id: 'ch17', title: 'Chapter 17', pdfFile: 'Chapter 17.pdf' },
            { id: 'ch18', title: 'Chapter 18', pdfFile: 'Chapter 18.pdf' },
            { id: 'ch19', title: 'Chapter 19', pdfFile: 'Chapter 19.pdf' },
        ]
    },
    {
        id: 'ncert-phy-11-1', title: 'Physics Part I', bookClass: '11', subject: 'Physics', code: 'keph1',
        totalChapters: 8,
        basePath: '11/Physics',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
            { id: 'ch2', title: 'Chapter 2', pdfFile: 'Chapter 2.pdf' },
            { id: 'ch3', title: 'Chapter 3', pdfFile: 'Chapter 3.pdf' },
            { id: 'ch4', title: 'Chapter 4', pdfFile: 'Chapter 4.pdf' },
            { id: 'ch5', title: 'Chapter 5', pdfFile: 'Chapter 5.pdf' },
            { id: 'ch6', title: 'Chapter 6', pdfFile: 'Chapter 6.pdf' },
            { id: 'ch7', title: 'Chapter 7', pdfFile: 'Chapter 7.pdf' },
            { id: 'ch8', title: 'Chapter 8', pdfFile: 'Chapter 8.pdf' },
        ]
    },
    {
        id: 'ncert-chem-11-1', title: 'Chemistry Part I', bookClass: '11', subject: 'Chemistry', code: 'kech1',
        totalChapters: 7,
        basePath: '11/Chemistry',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
            { id: 'ch2', title: 'Chapter 2', pdfFile: 'Chapter 2.pdf' },
            { id: 'ch3', title: 'Chapter 3', pdfFile: 'Chapter 3.pdf' },
            { id: 'ch4', title: 'Chapter 4', pdfFile: 'Chapter 4.pdf' },
            { id: 'ch5', title: 'Chapter 5', pdfFile: 'Chapter 5.pdf' },
            { id: 'ch6', title: 'Chapter 6', pdfFile: 'Chapter 6.pdf' },
            { id: 'ch7', title: 'Chapter 7', pdfFile: 'Chapter 7.pdf' },
        ]
    },
    {
        id: 'ncert-math-11', title: 'Mathematics', bookClass: '11', subject: 'Mathematics', code: 'kemh1',
        totalChapters: 14,
        basePath: '11/Mathematics',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
            { id: 'ch2', title: 'Chapter 2', pdfFile: 'Chapter 2.pdf' },
            { id: 'ch3', title: 'Chapter 3', pdfFile: 'Chapter 3.pdf' },
            { id: 'ch4', title: 'Chapter 4', pdfFile: 'Chapter 4.pdf' },
            { id: 'ch5', title: 'Chapter 5', pdfFile: 'Chapter 5.pdf' },
            { id: 'ch6', title: 'Chapter 6', pdfFile: 'Chapter 6.pdf' },
            { id: 'ch7', title: 'Chapter 7', pdfFile: 'Chapter 7.pdf' },
            { id: 'ch8', title: 'Chapter 8', pdfFile: 'Chapter 8.pdf' },
            { id: 'ch9', title: 'Chapter 9', pdfFile: 'Chapter 9.pdf' },
            { id: 'ch10', title: 'Chapter 10', pdfFile: 'Chapter 10.pdf' },
            { id: 'ch11', title: 'Chapter 11', pdfFile: 'Chapter 11.pdf' },
            { id: 'ch12', title: 'Chapter 12', pdfFile: 'Chapter 12.pdf' },
            { id: 'ch13', title: 'Chapter 13', pdfFile: 'Chapter 13.pdf' },
            { id: 'ch14', title: 'Chapter 14', pdfFile: 'Chapter 14.pdf' },
        ]
    },

    // Class 12
    {
        id: 'ncert-bio-12', title: 'Biology', bookClass: '12', subject: 'Biology', code: 'lebo1',
        totalChapters: 13,
        basePath: '12/Biology',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
            { id: 'ch2', title: 'Chapter 2', pdfFile: 'Chapter 2.pdf' },
            { id: 'ch3', title: 'Chapter 3', pdfFile: 'Chapter 3.pdf' },
            { id: 'ch4', title: 'Chapter 4', pdfFile: 'Chapter 4.pdf' },
            { id: 'ch5', title: 'Chapter 5', pdfFile: 'Chapter 5.pdf' },
            { id: 'ch6', title: 'Chapter 6', pdfFile: 'Chapter 6.pdf' },
            { id: 'ch7', title: 'Chapter 7', pdfFile: 'Chapter 7.pdf' },
            { id: 'ch8', title: 'Chapter 8', pdfFile: 'Chapter 8.pdf' },
            { id: 'ch9', title: 'Chapter 9', pdfFile: 'Chapter 9.pdf' },
            { id: 'ch10', title: 'Chapter 10', pdfFile: 'Chapter 10.pdf' },
            { id: 'ch11', title: 'Chapter 11', pdfFile: 'Chapter 11.pdf' },
            { id: 'ch12', title: 'Chapter 12', pdfFile: 'Chapter 12.pdf' },
            { id: 'ch13', title: 'Chapter 13', pdfFile: 'Chapter 13.pdf' },
        ]
    },
    {
        id: 'ncert-phy-12-1', title: 'Physics Part I', bookClass: '12', subject: 'Physics', code: 'leph1',
        totalChapters: 8,
        basePath: '12/Physics',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
            { id: 'ch2', title: 'Chapter 2', pdfFile: 'Chapter 2.pdf' },
            { id: 'ch3', title: 'Chapter 3', pdfFile: 'Chapter 3.pdf' },
            { id: 'ch4', title: 'Chapter 4', pdfFile: 'Chapter 4.pdf' },
            { id: 'ch5', title: 'Chapter 5', pdfFile: 'Chapter 5.pdf' },
            { id: 'ch6', title: 'Chapter 6', pdfFile: 'Chapter 6.pdf' },
            { id: 'ch7', title: 'Chapter 7', pdfFile: 'Chapter 7.pdf' },
            { id: 'ch8', title: 'Chapter 8', pdfFile: 'Chapter 8.pdf' },
        ]
    },
    {
        id: 'ncert-chem-12-1', title: 'Chemistry Part I', bookClass: '12', subject: 'Chemistry', code: 'lech1',
        totalChapters: 5,
        basePath: '12/Chemistry',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
            { id: 'ch2', title: 'Chapter 2', pdfFile: 'Chapter 2.pdf' },
            { id: 'ch3', title: 'Chapter 3', pdfFile: 'Chapter 3.pdf' },
            { id: 'ch4', title: 'Chapter 4', pdfFile: 'Chapter 4.pdf' },
            { id: 'ch5', title: 'Chapter 5', pdfFile: 'Chapter 5.pdf' },
        ]
    },

    // Class 10
    {
        id: 'ncert-sci-10', title: 'Science', bookClass: '10', subject: 'Science', code: 'jesc1',
        totalChapters: 13,
        basePath: '10/Science',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
            { id: 'ch2', title: 'Chapter 2', pdfFile: 'Chapter 2.pdf' },
            { id: 'ch3', title: 'Chapter 3', pdfFile: 'Chapter 3.pdf' },
        ]
    },
    {
        id: 'ncert-math-10', title: 'Mathematics', bookClass: '10', subject: 'Mathematics', code: 'jemh1',
        totalChapters: 14,
        basePath: '10/Mathematics',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
            { id: 'ch2', title: 'Chapter 2', pdfFile: 'Chapter 2.pdf' },
        ]
    },
    // Class 9
    {
        id: 'ncert-sci-9', title: 'Science', bookClass: '9', subject: 'Science', code: 'iesc1',
        totalChapters: 12,
        basePath: '9/Science',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
        ]
    },
    // Class 8
    {
        id: 'ncert-sci-8', title: 'Science', bookClass: '8', subject: 'Science', code: 'hesc1',
        totalChapters: 13,
        basePath: '8/Science',
        chapters: [
            { id: 'pre', title: 'Prelims', pdfFile: 'Introduction.pdf' },
            { id: 'ch1', title: 'Chapter 1', pdfFile: 'Chapter 1.pdf' },
        ]
    },
];

export const ncertClasses = ['12', '11', '10', '9', '8', '7', '6'];
export const ncertSubjectsByClass: Record<string, string[]> = {
    '12': ['Biology', 'Physics', 'Chemistry', 'Mathematics'],
    '11': ['Biology', 'Physics', 'Chemistry', 'Mathematics'],
    '10': ['Science', 'Mathematics', 'Social Science'],
    '9': ['Science', 'Mathematics', 'Social Science'],
    '8': ['Science', 'Mathematics', 'Social Science'],
    '7': ['Science', 'Mathematics', 'Social Science'],
    '6': ['Science', 'Mathematics', 'Social Science'],
};
