using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class SplitAiUsageCounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RequestCount",
                table: "ai_usage");

            migrationBuilder.AddColumn<int>(
                name: "GenerateCount",
                table: "ai_usage",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TranslateCount",
                table: "ai_usage",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GenerateCount",
                table: "ai_usage");

            migrationBuilder.DropColumn(
                name: "TranslateCount",
                table: "ai_usage");

            migrationBuilder.AddColumn<int>(
                name: "RequestCount",
                table: "ai_usage",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
