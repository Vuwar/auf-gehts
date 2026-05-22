using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Week> Weeks => Set<Week>();
    public DbSet<WordSet> WordSets => Set<WordSet>();
    public DbSet<Word> Words => Set<Word>();
    public DbSet<UserSetProgress> UserSetProgress => Set<UserSetProgress>();
    public DbSet<UserWeekCombinedProgress> UserWeekCombinedProgress => Set<UserWeekCombinedProgress>();
    public DbSet<WordCache> WordCache => Set<WordCache>();
    public DbSet<AiUsage> AiUsage => Set<AiUsage>();
    public DbSet<ReadingText> ReadingTexts => Set<ReadingText>();
    public DbSet<ReadingTextQuestion> ReadingTextQuestions => Set<ReadingTextQuestion>();
    public DbSet<EventLog> EventLogs => Set<EventLog>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<UserTagProgress> UserTagProgress => Set<UserTagProgress>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Email).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.Property(e => e.LastSeenAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<Week>(entity =>
        {
            entity.ToTable("weeks");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Title).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.Number).IsUnique();
        });

        modelBuilder.Entity<WordSet>(entity =>
        {
            entity.ToTable("word_sets");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.Slug).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.WeekId);
            entity.HasIndex(e => e.CreatedByUserId);
            entity.HasIndex(e => e.IsPublic);
            entity.HasIndex(e => e.IsOfficial);
            entity.HasOne(e => e.Week)
                  .WithMany(w => w.WordSets)
                  .HasForeignKey(e => e.WeekId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.CreatedByUser)
                  .WithMany()
                  .HasForeignKey(e => e.CreatedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Word>(entity =>
        {
            entity.ToTable("words");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Front).IsRequired();
            entity.Property(e => e.Back).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.WordSetId);
            entity.HasOne(e => e.WordSet)
                  .WithMany(s => s.Words)
                  .HasForeignKey(e => e.WordSetId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserSetProgress>(entity =>
        {
            entity.ToTable("user_set_progress");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.LastReviewedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => new { e.UserId, e.WordSetId }).IsUnique();
            entity.HasOne(e => e.WordSet)
                  .WithMany()
                  .HasForeignKey(e => e.WordSetId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>()
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserWeekCombinedProgress>(entity =>
        {
            entity.ToTable("user_week_combined_progress");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.LastReviewedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => new { e.UserId, e.WeekId }).IsUnique();
            entity.HasOne(e => e.Week)
                  .WithMany()
                  .HasForeignKey(e => e.WeekId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>()
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AiUsage>(entity =>
        {
            entity.ToTable("ai_usage");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.HasIndex(e => new { e.UserId, e.Date }).IsUnique();
        });

        modelBuilder.Entity<ReadingText>(entity =>
        {
            entity.ToTable("reading_texts");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Title).IsRequired();
            entity.Property(e => e.Content).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.WeekId);
            entity.HasOne(e => e.Week)
                  .WithMany(w => w.ReadingTexts)
                  .HasForeignKey(e => e.WeekId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<User>()
                  .WithMany()
                  .HasForeignKey(e => e.CreatedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ReadingTextQuestion>(entity =>
        {
            entity.ToTable("reading_text_questions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Prompt).IsRequired();
            entity.HasIndex(e => e.ReadingTextId);
            entity.HasOne<ReadingText>()
                  .WithMany(r => r.Questions)
                  .HasForeignKey(e => e.ReadingTextId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EventLog>(entity =>
        {
            entity.ToTable("event_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Timestamp).HasDefaultValueSql("now()");
            entity.Property(e => e.EventType).IsRequired();
            entity.HasIndex(e => e.Timestamp).IsDescending();
            entity.HasIndex(e => e.TraceId);
            entity.HasIndex(e => e.UserId);
            // Compound indexes serve the admin-logs hot paths:
            //   (Level, Timestamp DESC)     — recent errors/warnings filter + order
            //   (EventType, Timestamp DESC) — request.slow / db.slow_query lookups
            //   (Endpoint, Timestamp DESC)  — per-endpoint stats aggregations
            entity.HasIndex(e => new { e.Level, e.Timestamp }).IsDescending(false, true);
            entity.HasIndex(e => new { e.EventType, e.Timestamp }).IsDescending(false, true);
            entity.HasIndex(e => new { e.Endpoint, e.Timestamp }).IsDescending(false, true);
        });

        modelBuilder.Entity<WordCache>(entity =>
        {
            entity.ToTable("word_cache");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Word).IsRequired();
            entity.Property(e => e.PayloadJson).IsRequired();
            entity.Property(e => e.CachedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.Word).IsUnique();
        });

        modelBuilder.Entity<Tag>(entity =>
        {
            entity.ToTable("tags");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => new { e.WeekId, e.TagNumber }).IsUnique();
            entity.HasOne(e => e.Week)
                  .WithMany(w => w.Tags)
                  .HasForeignKey(e => e.WeekId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.WordSet)
                  .WithMany()
                  .HasForeignKey(e => e.WordSetId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.ReadingText)
                  .WithMany()
                  .HasForeignKey(e => e.ReadingTextId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<UserTagProgress>(entity =>
        {
            entity.ToTable("user_tag_progress");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.LastReviewedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => new { e.UserId, e.TagId }).IsUnique();
            entity.HasOne(e => e.Tag)
                  .WithMany()
                  .HasForeignKey(e => e.TagId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>()
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Friendship>(entity =>
        {
            entity.ToTable("friendships");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => new { e.RequesterId, e.AddresseeId }).IsUnique();
            entity.HasIndex(e => new { e.AddresseeId, e.Status });
            entity.HasIndex(e => new { e.RequesterId, e.Status });
            entity.HasOne(e => e.Requester)
                  .WithMany()
                  .HasForeignKey(e => e.RequesterId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Addressee)
                  .WithMany()
                  .HasForeignKey(e => e.AddresseeId)
                  .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
