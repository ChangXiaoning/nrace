var FS_PATTERN = {
    'D': ['D', 'R', 'W', 'O', 'S'],
    'R': ['D', 'W', 'C'],
    'W': ['D', 'R', 'W', 'C'],
    'D': ['D', 'R', 'O', 'C'],
    'C': ['R', 'O', 'C'],
    'S': ['D'],
    'O': ['O'],
};

module.exports = {
    FS_PATTERN: FS_PATTERN,
}