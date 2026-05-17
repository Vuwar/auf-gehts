using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class ReadingTextRedesign : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM reading_texts;");

            migrationBuilder.DropIndex(
                name: "IX_reading_texts_IsPublic",
                table: "reading_texts");

            migrationBuilder.DropColumn(
                name: "IsPublic",
                table: "reading_texts");

            migrationBuilder.AddColumn<Guid>(
                name: "WeekId",
                table: "reading_texts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "reading_text_questions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ReadingTextId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Prompt = table.Column<string>(type: "text", nullable: false),
                    OptionsJson = table.Column<string>(type: "text", nullable: true),
                    CorrectAnswer = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reading_text_questions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_reading_text_questions_reading_texts_ReadingTextId",
                        column: x => x.ReadingTextId,
                        principalTable: "reading_texts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_reading_texts_WeekId",
                table: "reading_texts",
                column: "WeekId");

            migrationBuilder.CreateIndex(
                name: "IX_reading_text_questions_ReadingTextId",
                table: "reading_text_questions",
                column: "ReadingTextId");

            migrationBuilder.AddForeignKey(
                name: "FK_reading_texts_weeks_WeekId",
                table: "reading_texts",
                column: "WeekId",
                principalTable: "weeks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_reading_texts_weeks_WeekId",
                table: "reading_texts");

            migrationBuilder.DropTable(
                name: "reading_text_questions");

            migrationBuilder.DropIndex(
                name: "IX_reading_texts_WeekId",
                table: "reading_texts");

            migrationBuilder.DropColumn(
                name: "WeekId",
                table: "reading_texts");

            migrationBuilder.AddColumn<bool>(
                name: "IsPublic",
                table: "reading_texts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_reading_texts_IsPublic",
                table: "reading_texts",
                column: "IsPublic");
        }
    }
}
