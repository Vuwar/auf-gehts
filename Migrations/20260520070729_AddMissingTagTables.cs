using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingTagTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    WeekId = table.Column<Guid>(type: "uuid", nullable: false),
                    TagNumber = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    WordSetId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReadingTextId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tags", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tags_reading_texts_ReadingTextId",
                        column: x => x.ReadingTextId,
                        principalTable: "reading_texts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_tags_weeks_WeekId",
                        column: x => x.WeekId,
                        principalTable: "weeks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tags_word_sets_WordSetId",
                        column: x => x.WordSetId,
                        principalTable: "word_sets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "user_tag_progress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TagId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompletedStepsMask = table.Column<int>(type: "integer", nullable: false),
                    LastStep = table.Column<int>(type: "integer", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_tag_progress", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_tag_progress_tags_TagId",
                        column: x => x.TagId,
                        principalTable: "tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_tag_progress_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tags_ReadingTextId",
                table: "tags",
                column: "ReadingTextId");

            migrationBuilder.CreateIndex(
                name: "IX_tags_WeekId_TagNumber",
                table: "tags",
                columns: new[] { "WeekId", "TagNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tags_WordSetId",
                table: "tags",
                column: "WordSetId");

            migrationBuilder.CreateIndex(
                name: "IX_user_tag_progress_TagId",
                table: "user_tag_progress",
                column: "TagId");

            migrationBuilder.CreateIndex(
                name: "IX_user_tag_progress_UserId_TagId",
                table: "user_tag_progress",
                columns: new[] { "UserId", "TagId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_tag_progress");

            migrationBuilder.DropTable(
                name: "tags");
        }
    }
}
