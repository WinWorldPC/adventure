// These are fixed values that aren't useful to be configurable.
module.exports = {
    // Compat with old WW routes
    tagMappings: {
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
        'tag-other': 'Other',
        'tag-server': 'Server'
    },
    // TODO: These could be localizable one day?
    fileTypeMappings: {
        "Archive": "File Archive",
        "35Floppy": "3½ Floppy",
        "525Floppy": "5¼ Floppy",
        "CDISO": "CD",
        "DVDISO": "DVD",
        // VM is implied here, IMHO
        "VPC": "Virtual PC",
        "VMWARE": "VMware",
        "VBOX": "VirtualBox",
    },
};