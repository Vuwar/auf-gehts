using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddSlug : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "word_sets",
                type: "text",
                nullable: false,
                defaultValue: "");

            // Backfill slugs from names (use Id suffix for uniqueness)
            migrationBuilder.Sql(@"
                UPDATE word_sets
                SET ""Slug"" = lower(regexp_replace(""Name"", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(""Id""::text, 1, 8)
                WHERE ""Slug"" = '' OR ""Slug"" IS NULL;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_word_sets_Slug",
                table: "word_sets",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_word_sets_Slug",
                table: "word_sets");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "word_sets");
        }
    }
}
