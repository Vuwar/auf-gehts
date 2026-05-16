using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddRolesAndOfficial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_word_sets_users_OwnerUserId",
                table: "word_sets");

            migrationBuilder.DropIndex(
                name: "IX_word_sets_OwnerUserId",
                table: "word_sets");

            migrationBuilder.DropColumn(
                name: "OwnerUserId",
                table: "word_sets");

            migrationBuilder.AddColumn<bool>(
                name: "IsOfficial",
                table: "word_sets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateIndex(
                name: "IX_word_sets_CreatedByUserId",
                table: "word_sets",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_word_sets_IsOfficial",
                table: "word_sets",
                column: "IsOfficial");

            migrationBuilder.AddForeignKey(
                name: "FK_word_sets_users_CreatedByUserId",
                table: "word_sets",
                column: "CreatedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Backfill: seed/official sets (assigned to a week, no creator) become IsOfficial
            migrationBuilder.Sql(@"
                UPDATE word_sets
                SET ""IsOfficial"" = true
                WHERE ""WeekId"" IS NOT NULL AND ""CreatedByUserId"" IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_word_sets_users_CreatedByUserId",
                table: "word_sets");

            migrationBuilder.DropIndex(
                name: "IX_word_sets_CreatedByUserId",
                table: "word_sets");

            migrationBuilder.DropIndex(
                name: "IX_word_sets_IsOfficial",
                table: "word_sets");

            migrationBuilder.DropColumn(
                name: "IsOfficial",
                table: "word_sets");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "users");

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerUserId",
                table: "word_sets",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_word_sets_OwnerUserId",
                table: "word_sets",
                column: "OwnerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_word_sets_users_OwnerUserId",
                table: "word_sets",
                column: "OwnerUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
