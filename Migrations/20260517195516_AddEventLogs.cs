using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddEventLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_logs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    Level = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "text", nullable: false),
                    Message = table.Column<string>(type: "text", nullable: true),
                    TraceId = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Endpoint = table.Column<string>(type: "text", nullable: true),
                    HttpMethod = table.Column<string>(type: "text", nullable: true),
                    StatusCode = table.Column<int>(type: "integer", nullable: true),
                    DurationMs = table.Column<long>(type: "bigint", nullable: true),
                    Concurrency = table.Column<int>(type: "integer", nullable: true),
                    Source = table.Column<string>(type: "text", nullable: true),
                    MetadataJson = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_logs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_Endpoint",
                table: "event_logs",
                column: "Endpoint");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_EventType",
                table: "event_logs",
                column: "EventType");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_Level",
                table: "event_logs",
                column: "Level");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_Timestamp",
                table: "event_logs",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_TraceId",
                table: "event_logs",
                column: "TraceId");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_UserId",
                table: "event_logs",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_logs");
        }
    }
}
