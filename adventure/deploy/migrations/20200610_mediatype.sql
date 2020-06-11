-- The media type table provides a data-driven way to manage a download's type.
-- The old ImageType column will be dropped at a later date.

create or replace table MediaType(
    MediaTypeUUID binary(16) primary key,
    FriendlyName varchar(50),
    ShortName varchar(50)
);

-- XXX: Foreign keys
create or replace table DownloadMediaType(
    DLUUID binary(16),
    MediaTypeUUID binary(16)
);

create or replace trigger BeforeCreateMediaType
    before insert
    on MediaType
    for each row
BEGIN
	set new.MediaTypeUUID = uuidbin(uuid());
END;

insert into MediaType (FriendlyName, ShortName)
values ('File archive', 'Archive'), ('3½" floppy image', '35Floppy'), ('5¼" floppy image', '525Floppy'),
       ('CD image', 'CDISO'), ('DVD image', 'DVDISO'), ('Virtual PC VM', 'VPC'), ('VMware VM', 'VMWARE'),
       ('VirtualBox VM', 'VBOX'), ('Tape image', 'Tape'), ('Document', 'Document'), ('Artwork', 'Artwork'),
       ('8" floppy image', '8Floppy'), ('Executable', 'Executable'), ('Self-extracting executable', 'SelfExtracting'),
       ('ROM/Firmware image', 'Firmware');

insert into DownloadMediaType (DLUUID, MediaTypeUUID)
    select d.DLUUID, mt.MediaTypeUUID from Downloads d
        inner join MediaType mt on mt.ShortName = d.ImageType;

create or replace function MediaTypeFriendlyNames(
    dluuid binary(16)
)
returns varchar(1024) deterministic
begin
    declare ret varchar(1024);
    set ret = '';
    select group_concat(distinct mt.FriendlyName separator '///')
        into ret
        from DownloadMediaType dmt
        inner join MediaType mt on dmt.MediaTypeUUID = mt.MediaTypeUUID
        where dmt.DLUUID = dluuid;
    return ret;
end;

create or replace function MediaTypeShortNames(
    dluuid binary(16)
)
returns varchar(1024) deterministic
begin
    declare ret varchar(1024);
    set ret = '';
    select group_concat(distinct mt.ShortName separator '///')
        into ret
        from DownloadMediaType dmt
        inner join MediaType mt on dmt.MediaTypeUUID = mt.MediaTypeUUID
        where dmt.DLUUID = dluuid;
    return ret;
end;

-- select d.Name, d.ImageType, mt.FriendlyName from Downloads d
--     inner join DownloadMediaType dmt on d.DLUUID = dmt.DLUUID
--     inner join MediaType mt on dmt.MediaTypeUUID = mt.MediaTypeUUID;

