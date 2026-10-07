export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      areas: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          name: string
          icon: string | null
          status: string
          description: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name: string
          icon?: string | null
          status?: string
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name?: string
          icon?: string | null
          status?: string
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      bookmarks: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          title: string
          url: string | null
          collection: string
          tags: string[]
          kind: string | null
          description: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title: string
          url?: string | null
          collection?: string
          tags?: string[]
          kind?: string | null
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title?: string
          url?: string | null
          collection?: string
          tags?: string[]
          kind?: string | null
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      books: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          title: string
          author: string | null
          category: string | null
          status: string
          pages_total: number | null
          pages_read: number
          rating: number | null
          started_at: string | null
          finished_at: string | null
          read_years: number[]
          favorite: boolean
          summary: string | null
          cover_path: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title: string
          author?: string | null
          category?: string | null
          status?: string
          pages_total?: number | null
          pages_read?: number
          rating?: number | null
          started_at?: string | null
          finished_at?: string | null
          read_years?: number[]
          favorite?: boolean
          summary?: string | null
          cover_path?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title?: string
          author?: string | null
          category?: string | null
          status?: string
          pages_total?: number | null
          pages_read?: number
          rating?: number | null
          started_at?: string | null
          finished_at?: string | null
          read_years?: number[]
          favorite?: boolean
          summary?: string | null
          cover_path?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      capture_projects: {
        Row: {
          user_id: string
          capture_id: string
          project_id: string
          created_at: string
        }
        Insert: {
          user_id?: string
          capture_id: string
          project_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          capture_id?: string
          project_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_projects_capture_id_fkey"
            columns: ["capture_id"]
            isOneToOne: false
            referencedRelation: "captures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      captures: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          title: string
          kind: string | null
          category: string | null
          tags: string[]
          url: string | null
          content: string | null
          area_id: string | null
          archived: boolean
          captured_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title?: string
          kind?: string | null
          category?: string | null
          tags?: string[]
          url?: string | null
          content?: string | null
          area_id?: string | null
          archived?: boolean
          captured_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title?: string
          kind?: string | null
          category?: string | null
          tags?: string[]
          url?: string | null
          content?: string | null
          area_id?: string | null
          archived?: boolean
          captured_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captures_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      collection_items: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          collection_id: string
          title: string
          props: Json
          content: string | null
          cover_path: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          collection_id: string
          title?: string
          props?: Json
          content?: string | null
          cover_path?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          collection_id?: string
          title?: string
          props?: Json
          content?: string | null
          cover_path?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      collections: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          name: string
          icon: string | null
          section: string
          description: string | null
          schema: Json
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name: string
          icon?: string | null
          section?: string
          description?: string | null
          schema?: Json
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name?: string
          icon?: string | null
          section?: string
          description?: string | null
          schema?: Json
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      content_items: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          title: string
          status: string
          format: string | null
          editorial_line_id: string | null
          platforms: string[]
          publish_date: string | null
          media_url: string | null
          reference_url: string | null
          published_url: string | null
          views: number | null
          likes: number | null
          comments: number | null
          shares: number | null
          idea_type: string | null
          script: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title: string
          status?: string
          format?: string | null
          editorial_line_id?: string | null
          platforms?: string[]
          publish_date?: string | null
          media_url?: string | null
          reference_url?: string | null
          published_url?: string | null
          views?: number | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          idea_type?: string | null
          script?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title?: string
          status?: string
          format?: string | null
          editorial_line_id?: string | null
          platforms?: string[]
          publish_date?: string | null
          media_url?: string | null
          reference_url?: string | null
          published_url?: string | null
          views?: number | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          idea_type?: string | null
          script?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_editorial_line_id_fkey"
            columns: ["editorial_line_id"]
            isOneToOne: false
            referencedRelation: "editorial_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      courses: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          name: string
          categories: string[]
          status: string
          url: string | null
          access_email: string | null
          progress: number | null
          notes: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name: string
          categories?: string[]
          status?: string
          url?: string | null
          access_email?: string | null
          progress?: number | null
          notes?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name?: string
          categories?: string[]
          status?: string
          url?: string | null
          access_email?: string | null
          progress?: number | null
          notes?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      day_notes: {
        Row: {
          id: string
          user_id: string
          day: string
          note: string | null
          extra: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          day: string
          note?: string | null
          extra?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day?: string
          note?: string | null
          extra?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      editorial_lines: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          name: string
          description: string | null
          color: string | null
          tags: string[]
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name: string
          description?: string | null
          color?: string | null
          tags?: string[]
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name?: string
          description?: string | null
          color?: string | null
          tags?: string[]
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_lines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      events: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          title: string
          starts_at: string
          ends_at: string | null
          all_day: boolean
          category: string | null
          done: boolean
          location: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title: string
          starts_at: string
          ends_at?: string | null
          all_day?: boolean
          category?: string | null
          done?: boolean
          location?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title?: string
          starts_at?: string
          ends_at?: string | null
          all_day?: boolean
          category?: string | null
          done?: boolean
          location?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      exam_subjects: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          name: string
          color: string | null
          exam: string | null
          notes: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name: string
          color?: string | null
          exam?: string | null
          notes?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name?: string
          color?: string | null
          exam?: string | null
          notes?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_subjects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      exam_topics: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          subject_id: string | null
          parent_id: string | null
          name: string
          stage: string | null
          questions: number
          correct: number
          last_review: string | null
          next_review: string | null
          notes: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          subject_id?: string | null
          parent_id?: string | null
          name: string
          stage?: string | null
          questions?: number
          correct?: number
          last_review?: string | null
          next_review?: string | null
          notes?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          subject_id?: string | null
          parent_id?: string | null
          name?: string
          stage?: string | null
          questions?: number
          correct?: number
          last_review?: string | null
          next_review?: string | null
          notes?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "exam_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      experiments: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          name: string
          kind: string | null
          status: string
          result: string | null
          starts_on: string | null
          ends_on: string | null
          hypothesis: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name: string
          kind?: string | null
          status?: string
          result?: string | null
          starts_on?: string | null
          ends_on?: string | null
          hypothesis?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name?: string
          kind?: string | null
          status?: string
          result?: string | null
          starts_on?: string | null
          ends_on?: string | null
          hypothesis?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      files: {
        Row: {
          id: string
          user_id: string
          path: string
          name: string
          mime: string | null
          size: number | null
          entity_type: string | null
          entity_id: string | null
          source_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          path: string
          name: string
          mime?: string | null
          size?: number | null
          entity_type?: string | null
          entity_id?: string | null
          source_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          path?: string
          name?: string
          mime?: string | null
          size?: number | null
          entity_type?: string | null
          entity_id?: string | null
          source_path?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      goal_months: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          goal_id: string | null
          year: number
          month: number
          target: number | null
          progress: number
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          goal_id?: string | null
          year: number
          month: number
          target?: number | null
          progress?: number
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          goal_id?: string | null
          year?: number
          month?: number
          target?: number | null
          progress?: number
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_months_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_months_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      goals: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          name: string
          tags: string[]
          year: number | null
          target: number | null
          progress: number
          unit: string | null
          reward: string | null
          deadline: string | null
          description: string | null
          done: boolean
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name: string
          tags?: string[]
          year?: number | null
          target?: number | null
          progress?: number
          unit?: string | null
          reward?: string | null
          deadline?: string | null
          description?: string | null
          done?: boolean
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name?: string
          tags?: string[]
          year?: number | null
          target?: number | null
          progress?: number
          unit?: string | null
          reward?: string | null
          deadline?: string | null
          description?: string | null
          done?: boolean
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      habit_logs: {
        Row: {
          id: string
          user_id: string
          habit_id: string
          day: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          habit_id: string
          day: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          habit_id?: string
          day?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      habits: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          name: string
          icon: string | null
          color: string | null
          active: boolean
          weekdays: number[]
          description: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name: string
          icon?: string | null
          color?: string | null
          active?: boolean
          weekdays?: number[]
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name?: string
          icon?: string | null
          color?: string | null
          active?: boolean
          weekdays?: number[]
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      insights: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          text: string
          source: string
          book_id: string | null
          experiment_id: string | null
          kind: string | null
          potential: string | null
          noted_on: string | null
          details: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          text: string
          source?: string
          book_id?: string | null
          experiment_id?: string | null
          kind?: string | null
          potential?: string | null
          noted_on?: string | null
          details?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          text?: string
          source?: string
          book_id?: string | null
          experiment_id?: string | null
          kind?: string | null
          potential?: string | null
          noted_on?: string | null
          details?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      pages: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          title: string
          icon: string | null
          cover_path: string | null
          parent_id: string | null
          section: string
          content: string
          favorite: boolean
          position: number
          source_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title?: string
          icon?: string | null
          cover_path?: string | null
          parent_id?: string | null
          section?: string
          content?: string
          favorite?: boolean
          position?: number
          source_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title?: string
          icon?: string | null
          cover_path?: string | null
          parent_id?: string | null
          section?: string
          content?: string
          favorite?: boolean
          position?: number
          source_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          name: string
          icon: string | null
          parent_id: string | null
          area_id: string | null
          description: string | null
          deadline: string | null
          publish_date: string | null
          done: boolean
          done_at: string | null
          archived: boolean
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name: string
          icon?: string | null
          parent_id?: string | null
          area_id?: string | null
          description?: string | null
          deadline?: string | null
          publish_date?: string | null
          done?: boolean
          done_at?: string | null
          archived?: boolean
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          name?: string
          icon?: string | null
          parent_id?: string | null
          area_id?: string | null
          description?: string | null
          deadline?: string | null
          publish_date?: string | null
          done?: boolean
          done_at?: string | null
          archived?: boolean
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      settings: {
        Row: {
          user_id: string
          display_name: string | null
          prefs: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id?: string
          display_name?: string | null
          prefs?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          display_name?: string | null
          prefs?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      study_sessions: {
        Row: {
          id: string
          user_id: string
          subject_id: string | null
          topic_id: string | null
          day: string
          minutes: number
          questions: number
          correct: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          subject_id?: string | null
          topic_id?: string | null
          day?: string
          minutes?: number
          questions?: number
          correct?: number
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject_id?: string | null
          topic_id?: string | null
          day?: string
          minutes?: number
          questions?: number
          correct?: number
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "exam_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          notion_id: string | null
          title: string
          status: string
          priority: string | null
          kind: string
          due_date: string | null
          due_time: string | null
          project_id: string | null
          description: string | null
          done_at: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title: string
          status?: string
          priority?: string | null
          kind?: string
          due_date?: string | null
          due_time?: string | null
          project_id?: string | null
          description?: string | null
          done_at?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notion_id?: string | null
          title?: string
          status?: string
          priority?: string | null
          kind?: string
          due_date?: string | null
          due_time?: string | null
          project_id?: string | null
          description?: string | null
          done_at?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalizar: {
        Args: { t: string }
        Returns: string
      }
      search_all: {
        Args: { q: string; max_results?: number }
        Returns: {
          kind: string
          id: string
          title: string
          snippet: string
          rank: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type TableName = keyof PublicSchema["Tables"]
