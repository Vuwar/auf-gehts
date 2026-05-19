using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddReadingTextAudio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AudioDurationSec",
                table: "reading_texts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AudioPath",
                table: "reading_texts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AudioUrl",
                table: "reading_texts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AudioVoice",
                table: "reading_texts",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AudioDurationSec",
                table: "reading_texts");

            migrationBuilder.DropColumn(
                name: "AudioPath",
                table: "reading_texts");

            migrationBuilder.DropColumn(
                name: "AudioUrl",
                table: "reading_texts");

            migrationBuilder.DropColumn(
                name: "AudioVoice",
                table: "reading_texts");
        }
    }
}
