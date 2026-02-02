import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Pencil, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Save,
  Code,
  Building2,
  Activity,
  Briefcase
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectAssignment {
  id: string;
  project_id: string;
  client_name: string;
  activity_name: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectManagement() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<(Project & { assignments: ProjectAssignment[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<ProjectAssignment | null>(null);
  const [projectForm, setProjectForm] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true,
    client_name: '',
    activity_name: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          *,
          assignments:project_assignments(
            id,
            project_id,
            client_name,
            activity_name,
            created_at,
            updated_at
          )
        `)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);
      console.log('Fetched projects:', projectsData);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = async (projectId: string) => {
    const trimmedClientName = projectForm.client_name.trim();
    const trimmedActivityName = projectForm.activity_name.trim();

    if (!trimmedClientName || !trimmedActivityName) {
      throw new Error('Client name and activity name are required');
    }

    // Check for duplicate assignment for the given project, excluding the current assignment if editing
    let query = supabase
      .from('project_assignments')
      .select('id, project_id, client_name, activity_name')
      .eq('project_id', projectId)
      .eq('client_name', trimmedClientName)
      .eq('activity_name', trimmedActivityName);

    if (selectedAssignment) {
      query = query.neq('id', selectedAssignment.id);
    }

    const { data: assignmentCheck, error: assignmentError } = await query.limit(1);

    if (assignmentError) {
      console.error('Assignment validation error:', assignmentError);
      throw new Error('Error checking assignment: ' + assignmentError.message);
    }
    if (assignmentCheck && assignmentCheck.length > 0) {
      console.log('Duplicate assignment found:', assignmentCheck[0]);
      throw new Error('This client and activity combination already exists for this project');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const trimmedCode = projectForm.code.trim();
      const trimmedName = projectForm.name.trim();
      const trimmedDescription = projectForm.description.trim();
      const trimmedClientName = projectForm.client_name.trim();
      const trimmedActivityName = projectForm.activity_name.trim();

      if (!trimmedCode) {
        throw new Error('Project code is required');
      }
      if (!trimmedName) {
        throw new Error('Project name is required');
      }

      let projectId: string;

      if (selectedProject) {
        // Update existing project
        const { data, error: updateError } = await supabase
          .from('projects')
          .update({
            code: trimmedCode,
            name: trimmedName,
            description: trimmedDescription,
            is_active: projectForm.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedProject.id)
          .select()
          .single();

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }
        if (!data) throw new Error('No data returned from update');
        projectId = selectedProject.id;
        console.log('Project updated:', data);
      } else {
        // Check for existing project with same code OR name
        const { data: existingProjects, error: fetchError } = await supabase
          .from('projects')
          .select('id, code, name')
          .or(`code.eq.${trimmedCode},name.eq.${trimmedName}`)
          .limit(1);

        if (fetchError) {
          console.error('Fetch existing project error:', fetchError);
          throw fetchError;
        }

        if (existingProjects && existingProjects.length > 0) {
          projectId = existingProjects[0].id;
          console.log('Using existing project:', existingProjects[0]);
        } else {
          // Create new project
          const { data: newProject, error: createError } = await supabase
            .from('projects')
            .insert({
              code: trimmedCode,
              name: trimmedName,
              description: trimmedDescription,
              is_active: projectForm.is_active
            })
            .select()
            .single();

          if (createError) {
            console.error('Create error:', createError);
            throw createError;
          }
          if (!newProject) throw new Error('No data returned from create');
          projectId = newProject.id;
          console.log('Project created:', newProject);
        }
      }

      // Handle assignment (create or update)
      if (trimmedClientName || trimmedActivityName) {
        await validateForm(projectId);

        if (selectedAssignment) {
          // Update existing assignment
          const { data: assignmentData, error: assignmentError } = await supabase
            .from('project_assignments')
            .update({
              client_name: trimmedClientName,
              activity_name: trimmedActivityName,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedAssignment.id)
            .select()
            .single();

          if (assignmentError) {
            console.error('Assignment update error:', assignmentError);
            throw assignmentError;
          }
          console.log('Assignment updated:', assignmentData);
        } else {
          // Create new assignment
          const { data: assignmentData, error: assignmentError } = await supabase
            .from('project_assignments')
            .insert({
              project_id: projectId,
              client_name: trimmedClientName,
              activity_name: trimmedActivityName
            })
            .select()
            .single();

          if (assignmentError) {
            console.error('Assignment create error:', assignmentError);
            throw assignmentError;
          }
          console.log('Assignment created:', assignmentData);
        }
      }

      setSuccess(selectedProject ? 'Project updated successfully' : selectedAssignment ? 'Activity updated successfully' : 'Activity added successfully');
      setShowModal(false);
      setSelectedAssignment(null);
      await fetchProjects();
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.message || 'An error occurred while saving');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAssignment = (project: Project, assignment: ProjectAssignment) => {
    setSelectedProject(project);
    setSelectedAssignment(assignment);
    setProjectForm({
      code: project.code,
      name: project.name,
      description: project.description || '',
      is_active: project.is_active,
      client_name: assignment.client_name,
      activity_name: assignment.activity_name
    });
    setShowModal(true);
  };

  const handleAddActivity = (project: Project) => {
    setSelectedProject(project);
    setSelectedAssignment(null);
    setProjectForm({
      code: project.code,
      name: project.name,
      description: project.description || '',
      is_active: project.is_active,
      client_name: '',
      activity_name: ''
    });
    setShowModal(true);
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const { error: assignmentsError } = await supabase
        .from('project_assignments')
        .delete()
        .eq('project_id', projectId);

      if (assignmentsError) {
        console.error('Delete assignments error:', assignmentsError);
        throw assignmentsError;
      }

      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (projectError) {
        console.error('Delete project error:', projectError);
        throw projectError;
      }

      setSuccess('Project deleted successfully');
      await fetchProjects();
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(error.message);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this client/activity assignment?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('project_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) {
        console.error('Delete assignment error:', error);
        throw error;
      }

      setSuccess('Assignment removed successfully');
      await fetchProjects();
    } catch (error: any) {
      console.error('Delete assignment error:', error);
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Admin Settings
          </button>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Project Management</h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage projects and their associated clients and activities
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedProject(null);
                setSelectedAssignment(null);
                setProjectForm({
                  code: '',
                  name: '',
                  description: '',
                  is_active: true,
                  client_name: '',
                  activity_name: ''
                });
                setShowModal(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Project/Activity
            </button>
          </div>

          {(error || success) && (
            <div className={`p-4 ${error ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm ${error ? 'text-red-800' : 'text-green-800'}`}>
                    {error || success}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {projects.map((project) => (
                  <div key={project.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Code className="h-6 w-6 text-blue-600" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {project.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              Code: {project.code}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedProject(project);
                              setSelectedAssignment(null);
                              setProjectForm({
                                code: project.code,
                                name: project.name,
                                description: project.description || '',
                                is_active: project.is_active,
                                client_name: '',
                                activity_name: ''
                              });
                              setShowModal(true);
                            }}
                            className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleAddActivity(project)}
                            className="p-2 text-green-600 hover:text-green-800 rounded-full hover:bg-green-50"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {project.description && (
                        <p className="mt-2 text-sm text-gray-600">
                          {project.description}
                        </p>
                      )}

                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900">
                          Client & Activity Assignments
                        </h4>
                        <div className="mt-2 space-y-2">
                          {project.assignments.map((assignment) => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center text-gray-600">
                                  <Building2 className="h-4 w-4 mr-1" />
                                  <span className="text-sm">{assignment.client_name}</span>
                                </div>
                                <div className="flex items-center text-gray-600">
                                  <Activity className="h-4 w-4 mr-1" />
                                  <span className="text-sm">{assignment.activity_name}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEditAssignment(project, assignment)}
                                  className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAssignment(assignment.id)}
                                  className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {project.assignments.length === 0 && (
                            <p className="text-sm text-gray-500 italic">
                              No client & activity assignments yet
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          project.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {project.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedProject ? (selectedAssignment ? 'Edit Activity' : 'Edit Project/Add Activity') : 'Add Project/Activity'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedAssignment(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Project Code <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <Code className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={projectForm.code}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, code: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="PPO"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Project Name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Project description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={projectForm.client_name}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, client_name: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Client Organization"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Activity Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={projectForm.activity_name}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, activity_name: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Project Activity"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={projectForm.is_active}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Active Project
                </label>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedAssignment(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Saving...' : (
                    <>
                      <Save className="h-4 w-4 inline-block mr-2" />
                      {selectedProject ? (selectedAssignment ? 'Update Activity' : 'Update Project/Add Activity') : 'Add Project/Activity'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}