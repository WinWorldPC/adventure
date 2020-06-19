create or replace table Architecture(
    ArchitectureUUID binary(16) primary key,
    FriendlyName varchar(50),
    ShortName varchar(50)
);

-- XXX: Foreign keys
create or replace table DownloadArchitecture(
    DLUUID binary(16),
    ArchitectureUUID binary(16)
);

create or replace trigger BeforeCreateArchitecture
    before insert
    on Architecture
    for each row
BEGIN
	set new.ArchitectureUUID = uuidbin(uuid());
END;

insert into Architecture (FriendlyName, ShortName)
values ('x86 (16-bit)', 'x86'), ('x86 (32-bit)', 'x86-32'), ('Motorola 680x0', 'm68k'), ('PowerPC (32-bit)', 'ppc'),
       ('x86 (64-bit)', 'amd64'), ('6502', 'mos6502'), ('PowerPC (64-bit)', 'ppc64'), ('SPARC (32-bit)', 'SPARC'),
       ('SPARC (64-bit)', 'SPARC64'), ('MIPS (32-bit)', 'MIPS'), ('MIPS (64-bit)', 'MIPS64'), ('Alpha', 'Alpha'),
       ('PA-RISC', 'PARISC'), ('Z80', 'Z80'), ('Intel 8080', 'Intel8080'), ('VAX', 'VAX'), ('IBM System/3x0', 'IBM3x0'),
       ('SuperH', 'SuperH'), ('Other', 'Other');

insert into DownloadArchitecture (DLUUID, ArchitectureUUID)
    select d.DLUUID, a.ArchitectureUUID from Downloads d
        inner join Architecture a on find_in_set(a.ShortName, d.Arch);

create or replace function DownloadArchitectureFriendlyNames(
    dluuid binary(16)
)
returns varchar(1024) deterministic
begin
    declare ret varchar(1024);
    set ret = '';
    select group_concat(distinct a.FriendlyName separator '///')
        into ret
        from DownloadArchitecture da
        inner join Architecture a on da.ArchitectureUUID = a.ArchitectureUUID
        where da.DLUUID = dluuid;
    return ret;
end;

create or replace function DownloadArchitectureShortNames(
    dluuid binary(16)
)
returns varchar(1024) deterministic
begin
    declare ret varchar(1024);
    set ret = '';
    select group_concat(distinct a.ShortName separator '///')
        into ret
        from DownloadArchitecture da
        inner join Architecture a on da.ArchitectureUUID = a.ArchitectureUUID
        where da.DLUUID = dluuid;
    return ret;
end;

