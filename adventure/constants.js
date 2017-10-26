function invert(o) {
    return Object.keys(o).reduce(function (obj, key) {
        obj[ o[key] ] = key;
        return obj;
    }, {});
}

// adjust to match your schema
var tagMappings = {
    'tag-word-processor': 'Word Processor',
    'tag-spreadsheet': 'Spreadsheet',
    'tag-database': 'Database',
    'tag-presentations': 'Presentations',
    'tag-browser': 'Web Browser',
    'tag-chat': 'Chat',
    'tag-utility': 'Utility',
    'tag-graphics': 'Graphics',
    'tag-publishing': 'Publishing',
    'tag-financial': 'Financial',
    'tag-reference': 'Reference',
    'tag-editor': 'Editor',
    'tag-communications': 'Communications',
    'tag-novelty': 'Novelty',
    'tag-pim': 'PIM',
    'tag-video': 'Video',
    'tag-audio': 'Audio',
    'tag-document': 'Document',
    'tag-media-player': 'Media Player',
    'tag-virtualization': 'Virtualization',
    'tag-archive': 'Archive',
    'tag-server': 'Server',
    'tag-planning': 'Planning',
    'tag-math': 'Mathematics',
    'tag-education': 'Education',
    'tag-engineering': 'Engineering',
    'tag-other': 'Other',
};
var tagMappingsInverted = invert(tagMappings);
var platformMappings = {
    'platform-dos': 'DOS',
    'platform-cpm': 'CPM',
    'platform-windows': 'Windows',
    'platform-os2': 'OS2',
    'platform-unix': 'Unix',
    'platform-linux': 'Linux',
    'platform-macos': 'MacOS',
    'platform-macosx': 'Mac OS X',
    'platform-other': 'Other'
}
var platformMappingsInverted = invert(platformMappings);
var fileTypeMappings = {
    "Archive": "Archive",
    "35Floppy": "3½ Floppy",
    "525Floppy": "5¼ Floppy",
    "CDISO": "CD",
    "DVDISO": "DVD",
    // VM is implied here, IMHO
    "VPC": "Virtual PC",
    "VMWARE": "VMware",
    "VBOX": "VirtualBox",
};
var fileTypeMappingsInverted = invert(fileTypeMappings);
var categoryMappings = {
    'operating-systems': 'OS',
    'applications': 'Game',
    'games': 'Application',
    'dev': 'DevTool',
    'sys': 'System'
};
var categoryMappingsInverted = invert(categoryMappings);

// These are fixed values that aren't useful to be configurable.
module.exports = {
    // Compat with old WW routes
    tagMappings: tagMappings,
    tagMappingsInverted: tagMappingsInverted,
    platformMappings: platformMappings,
    platformMappingsInverted: platformMappingsInverted,
    // TODO: These could be localizable one day?
    fileTypeMappings: fileTypeMappings,
    fileTypeMappingsInverted: fileTypeMappingsInverted,
    categoryMappings: categoryMappings,
    categoryMappingsInverted: categoryMappingsInverted,
};